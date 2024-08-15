import Router from '@koa/router'
import { CallbackUrlBox, EvmConfig, EvmRpcClient } from '../interface/interface'
import Monitor from '../monitor/Monitor'
import { watchConfirmIn, watchConfirmOut, watchRefundIn, watchRefundOut, watchReputation, watchTransferIn, watchTransferOut } from '../serverUtils/WatcherFactory'
import needle from 'needle'
import retry from 'async-retry';
import * as _ from "lodash"
import { SystemOut } from '../utils/systemOut'
import { sha256 } from '../utils/hash'
import { MonitorManager } from '../monitor/MonitorManager'
function getFlagHeight(num: number): number {
    return Math.ceil(num / 5) * 5;
}

const watchHeight = (callbackUrl: CallbackUrlBox, monitor: Monitor, filteridList: string[]) => {
    if (callbackUrl.on_height_update == undefined) {
        return;
    }
    const blockNumberCache: Map<number, {
        hit: number
        data: any[]
    }> = new Map()
    const blockEventConfirm: Map<number, { confirmCount: number, createTime: number }> = new Map();
    let cursorBlock = -1;
    const on_height_update_url = callbackUrl.on_height_update

    setInterval(() => {
        for (const [k, v] of blockEventConfirm) {
            if (new Date().getTime() - v.createTime > 1000 * 60 * 10) {
                SystemOut.warn(`delete ${k}`)
                blockEventConfirm.delete(k)
            }
        }
    }, 1000 * 10)
    const doSend = (height: number) => {
        const STOREKEY = `height_updates_${monitor.evmConfig.system_chain_id}`
        retry(async () => {
            SystemOut.debug("-->", "send onHeightUpdate", on_height_update_url, height);
            const sendData = {
                type: 'update_height',
                height: height,
                data: blockNumberCache.get(height).data
            }
            if (sendData.data.length > 0) {
                SystemOut.debug("🐆")
                monitor.redis.zadd(STOREKEY, Date.now(), JSON.stringify(sendData));
            }
            await needle('post', on_height_update_url,
                sendData,
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                })
        }, {
            retries: 10,
            minTimeout: 1000, // 1 second
            maxTimeout: Infinity,
            onRetry: (error, attempt) => {
                SystemOut.debug(`attempt ${attempt}`);
                SystemOut.error(error)
            },
        });
    }
    const sender = async () => {
        for (const [key, _] of blockNumberCache) {
            if (key < cursorBlock) {
                try {
                    await doSend(key)
                } catch (e) {
                    SystemOut.error(e)
                } finally {
                    blockNumberCache.delete(key)
                }
            }
        }
    }
    const mergeData = (event: any) => {
        const height = getFlagHeight(event.event.blockNumber)
        const cachedData = blockNumberCache.get(height)
        if (!cachedData) {
            blockNumberCache.set(height, {
                hit: 1,
                data: [event]
            })
        } else {
            cachedData.data.push(event)
        }
    }

    process.nextTick(async () => {
        for (; ;) {
            await sender();
            await new Promise((resolve) => { setTimeout(() => { resolve(true) }, 100 * 2) })
        }
    })
    monitor.watchHeight(
        {
            onHeightUpdate: async (heightIn: number, filterId: string) => {
                const flagHeight = getFlagHeight(heightIn)
                const cachedData = blockNumberCache.get(flagHeight)
                if (!cachedData) {
                    blockNumberCache.set(flagHeight, {
                        hit: 1,
                        data: []
                    })
                }
                if (!filteridList.includes(filterId)) {
                    return
                }
                if (!blockEventConfirm.get(heightIn)) {
                    blockEventConfirm.set(heightIn, { confirmCount: 1, createTime: new Date().getTime() })
                } else {
                    blockEventConfirm.get(heightIn).confirmCount = blockEventConfirm.get(heightIn).confirmCount + 1
                }
                // systemOutput.debug(blockEventConfirm.get(heightIn).confirmCount, filteridList.length)
                if (blockEventConfirm.get(heightIn).confirmCount >= filteridList.length) {
                    cursorBlock = heightIn;
                    return
                }
            }
        }
    )

    return mergeData

}

const startHistoryTask = async (startBlock: number, endBlock: number, callbackUrl: CallbackUrlBox, client: EvmRpcClient, config: EvmConfig, merge: boolean) => {
    const monitorName = `history-${startBlock}_${endBlock}`
    const historyMonitor = MonitorManager.getInst().createMonitor(monitorName)
    MonitorManager.getInst().initMoniterAsHistory(monitorName, client, startBlock, endBlock)
    const filterIdList: string[] = []
    const mergeData = watchHeight(callbackUrl, historyMonitor, filterIdList)

    filterIdList.push(watchTransferOut(historyMonitor, callbackUrl.on_transfer_out, config, merge, mergeData))
    filterIdList.push(watchTransferIn(historyMonitor, callbackUrl.on_transfer_in, config, merge, mergeData))
    filterIdList.push(watchConfirmOut(historyMonitor, callbackUrl.on_confirm_out, config, merge, mergeData))
    filterIdList.push(watchConfirmIn(historyMonitor, callbackUrl.on_confirm_in, config, merge, mergeData))
    filterIdList.push(watchRefundOut(historyMonitor, callbackUrl.on_refunded_out, config, merge, mergeData))
    filterIdList.push(watchRefundIn(historyMonitor, callbackUrl.on_refunded_in, config, merge, mergeData))

    historyMonitor.historyModeStart()
}

const startReputationHistoryTask = async (startBlock: number, endBlock: number, callbackUrl: CallbackUrlBox, client: EvmRpcClient, config: EvmConfig, merge: boolean) => {
    const monitorName = `reputation-history-${startBlock}_${endBlock}`
    const historyMonitor = MonitorManager.getInst().createMonitor(monitorName)
    MonitorManager.getInst().initMoniterAsHistory(monitorName, client, startBlock, endBlock)
    const filterIdList: string[] = []
    const mergeData = watchHeight(callbackUrl, historyMonitor, filterIdList)
    filterIdList.push(watchReputation(historyMonitor, callbackUrl.on_reputation, config, merge, mergeData))
    historyMonitor.historyModeStart()
}

export default class ApiSupport {

    registerCache: Map<string, Map<string, boolean>> = new Map()

    constructor() {
        this.registerCache.set('support', new Map());
        this.registerCache.set('support_history', new Map());
        this.registerCache.set('support_reputation', new Map());
        this.registerCache.set('support_reputation_history', new Map());
    }

    private _linkRouter = (router: Router, config: EvmConfig) => {
        router.post(`/support/history`, async (ctx, next) => {
            console.log('on /support/history', ctx.request.body)

            const startBlock = (ctx.request.body as any).start
            const endBlock = (ctx.request.body as any).end
            const callbackUrl = (ctx.request.body as any).callback
            let merge: boolean = (ctx.request.body as any).merge

            if (merge == undefined) {
                merge = false
            }

            if (startBlock == undefined) {
                ctx.response.body = {
                    code: 30209,
                    message: 'start is a required parameter '
                }
                return
            }
            if (endBlock == undefined) {
                ctx.response.body = {
                    code: 30209,
                    message: 'endBlock is a required parameter '
                }
                return
            }
            if (callbackUrl == undefined) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is a required parameter '
                }
                return
            }

            const cacheKey = sha256(JSON.stringify({
                startBlock: startBlock,
                endBlock: endBlock,
                callbackUrl: callbackUrl,
                merge: merge
            }))

            const cache = this.registerCache.get('support_history')
            if (cache.has(cacheKey)) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is already registered'
                }
                SystemOut.debug('callbackUrl is already registered for support history endpoind', startBlock, endBlock, callbackUrl, merge)
                return
            }

            startHistoryTask(startBlock, endBlock, callbackUrl, ctx.rpcClient, config, merge)

            ctx.response.body = {
                code: 200,
                message: 'history task started'
            }

            cache.set(cacheKey, true)
            SystemOut.debug('new support history registered', startBlock, endBlock, callbackUrl, merge)
        })

        router.post(`/support/register`, async (ctx, next) => {
            console.log('on /support/register', ctx.request.body)

            const callbackUrl = (ctx.request.body as any).callback
            let merge: boolean = (ctx.request.body as any).merge

            if (merge == undefined) {
                merge = false
            }

            if (callbackUrl == undefined) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is a required parameter '
                }
                return
            }

            const cacheKey = sha256(JSON.stringify({
                callbackUrl: callbackUrl,
                merge: merge
            }))

            const cache = this.registerCache.get('support')
            if (cache.has(cacheKey)) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is already registered'
                }
                SystemOut.debug("callbackUrl is already registered for support endpoind", callbackUrl, merge)
                return
            }
            const filteridList: string[] = []
            const mergeData = watchHeight(callbackUrl, ctx.monitor, filteridList)

            filteridList.push(watchTransferOut(ctx.monitor, callbackUrl.on_transfer_out, config, merge, mergeData))
            filteridList.push(watchTransferIn(ctx.monitor, callbackUrl.on_transfer_in, config, merge, mergeData))
            filteridList.push(watchConfirmOut(ctx.monitor, callbackUrl.on_confirm_out, config, merge, mergeData))
            filteridList.push(watchConfirmIn(ctx.monitor, callbackUrl.on_confirm_in, config, merge, mergeData))
            filteridList.push(watchRefundOut(ctx.monitor, callbackUrl.on_refunded_out, config, merge, mergeData))
            filteridList.push(watchRefundIn(ctx.monitor, callbackUrl.on_refunded_in, config, merge, mergeData))

            ctx.response.body = {
                code: 200,
                message: 'register succeed'
            }

            cache.set(cacheKey, true)
            SystemOut.debug('new support registered', callbackUrl, merge)
        })

        router.post(`/support/history_reputation`, async (ctx, next) => {
            console.log('on /support/history_reputation', ctx.request.body)

            const startBlock = (ctx.request.body as any).start
            const endBlock = (ctx.request.body as any).end
            const callbackUrl = (ctx.request.body as any).callback
            let merge: boolean = (ctx.request.body as any).merge

            if (merge == undefined) {
                merge = false
            }

            if (startBlock == undefined) {
                ctx.response.body = {
                    code: 30209,
                    message: 'start is a required parameter '
                }
                return
            }
            if (endBlock == undefined) {
                ctx.response.body = {
                    code: 30209,
                    message: 'endBlock is a required parameter '
                }
                return
            }
            if (callbackUrl == undefined) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is a required parameter '
                }
                return
            }

            const cacheKey = sha256(JSON.stringify({
                startBlock: startBlock,
                endBlock: endBlock,
                callbackUrl: callbackUrl,
                merge: merge
            }))

            const cache = this.registerCache.get('support_reputation_history')
            if (cache.has(cacheKey)) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is already registered'
                }
                SystemOut.debug('callbackUrl is already registered for support reputation history endpoind', startBlock, endBlock, callbackUrl, merge)
                return
            }

            startReputationHistoryTask(startBlock, endBlock, callbackUrl, ctx.rpcClient, config, merge)

            ctx.response.body = {
                code: 200,
                message: 'history task started'
            }

            cache.set(cacheKey, true)
            SystemOut.debug('new support reputation history registered', startBlock, endBlock, callbackUrl, merge)
        })

        router.post(`/support/register_reputation`, async (ctx, next) => {
            console.log('on /support/register_reputation', ctx.request.body)

            const callbackUrl = (ctx.request.body as any).callback
            let merge: boolean = (ctx.request.body as any).merge

            if (merge == undefined) {
                merge = false
            }
            if (callbackUrl == undefined) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is a required parameter '
                }
                return
            }

            const cacheKey = sha256(JSON.stringify({
                callbackUrl: callbackUrl,
                merge: merge
            }))

            const cache = this.registerCache.get('support_reputation')
            if (cache.has(cacheKey)) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is already registered'
                }
                SystemOut.debug("callbackUrl is already registered for support reputation endpoind", callbackUrl, merge)
                return
            }
            const filterIdList: string[] = []
            const mergeData = watchHeight(callbackUrl, ctx.monitor, filterIdList)

            filterIdList.push(watchReputation(ctx.monitor, callbackUrl.on_reputation, config, merge, mergeData))



            ctx.response.body = {
                code: 200,
                message: 'register succeed'
            }

            cache.set(cacheKey, true)
            SystemOut.debug('new support reputation registered', callbackUrl, merge)
        })
    }
    public get linkRouter() {
        return this._linkRouter
    }
    public set linkRouter(value) {
        this._linkRouter = value
    }
}