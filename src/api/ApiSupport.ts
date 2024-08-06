import Router from '@koa/router'
import { CallbackUrlBox, EvmConfig, EvmRpcClient } from '../interface/interface'
import Monitor from '../monitor/Monitor'
import { watchConfirmIn, watchConfirmOut, watchRefundIn, watchRefundOut, watchReputation, watchTransferIn, watchTransferOut } from '../serverUtils/WatcherFactory'
import needle from 'needle'
import retry from 'async-retry';
import * as _ from "lodash"
import { systemOutput } from '../utils/systemOutput'
import { sha256 } from '../utils/hash'
function getFlagHeight(num: number): number {
    return Math.ceil(num / 5) * 5;
}

const watchHeight = (callbackUrl: CallbackUrlBox, monitor: Monitor, isReputation: boolean) => {
    if (callbackUrl.on_height_update != undefined) {

        const blockNumberCache: {
            [key: number]: {
                hit: number
                data: any[]
            }
        } = {}

        const on_height_update_url = callbackUrl.on_height_update
        const mergeData = (event) => {

            const height = getFlagHeight(event.event.blockNumber)
            if (blockNumberCache[height] == undefined) {
                blockNumberCache[height] = {
                    hit: 1,
                    data: [event]
                }
            } else {
                blockNumberCache[height].data.push(event)
            }
            
        }

        monitor.watchHeight(
            {
                onHeightUpdate: async (heightIn) => {

                    // fix last block no event
                    // const height = heightIn
                    const height = getFlagHeight(heightIn)

                    if (blockNumberCache[height] == undefined) {
                        blockNumberCache[height] = {
                            hit: 1,
                            data: []
                        }
                    } else {
                        blockNumberCache[height].hit++
                    }

                    const doPost = isReputation ? blockNumberCache[height].hit >= 1 : blockNumberCache[height].hit >= 6

                    if (doPost) {
                        retry(async () => {
                            systemOutput.debug("send onHeightUpdate ", on_height_update_url, height);
                            const sendData = {
                                type: 'update_height',
                                height: height,
                                data: blockNumberCache[height].data
                            }
                            await needle('post', on_height_update_url,
                                sendData,
                                {
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                })
                        },
                        {
                            retries: 10,
                            minTimeout: 1000, // 1 second
                            maxTimeout: Infinity,
                            onRetry: (error, attempt) => {
                                systemOutput.debug(`attempt ${attempt}`);
                                systemOutput.error(error)
                            },
                        });
                    }
                }
            }
        )

        return mergeData
    }
}

const startHistoryTask = async (startBlock: number, endBlock: number, callbackUrl: CallbackUrlBox, client: EvmRpcClient, config: EvmConfig, merge: boolean) => {
    const historyMonitor = new Monitor()
    historyMonitor.setConfigModeHistory(client, startBlock, endBlock)

    const mergeData = watchHeight(callbackUrl, historyMonitor, false)

    watchTransferOut(historyMonitor, callbackUrl.on_transfer_out, config, merge, mergeData)
    watchTransferIn(historyMonitor, callbackUrl.on_transfer_in, config, merge, mergeData)
    watchConfirmOut(historyMonitor, callbackUrl.on_confirm_out, config, merge, mergeData)
    watchConfirmIn(historyMonitor, callbackUrl.on_confirm_in, config, merge, mergeData)
    watchRefundOut(historyMonitor, callbackUrl.on_refunded_out, config, merge, mergeData)
    watchRefundIn(historyMonitor, callbackUrl.on_refunded_in, config, merge, mergeData)

    historyMonitor.historyModeStart()
}

const startReputationHistoryTask = async (startBlock: number, endBlock: number, callbackUrl: CallbackUrlBox, client: EvmRpcClient, config: EvmConfig, merge: boolean) => {
    const historyMonitor = new Monitor()
    historyMonitor.setConfigModeHistory(client, startBlock, endBlock)

    const mergeData = watchHeight(callbackUrl, historyMonitor, true)

    watchReputation(historyMonitor, callbackUrl.on_reputation, config, merge, mergeData)

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

            let cacheKey = sha256(JSON.stringify({
                startBlock: startBlock,
                endBlock: endBlock,
                callbackUrl: callbackUrl,
                merge: merge
            }))

            let cache = this.registerCache.get('support_history')
            if (cache.has(cacheKey)) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is already registered'
                }
                systemOutput.debug('callbackUrl is already registered for support history endpoind', startBlock, endBlock, callbackUrl, merge)
                return
            }

            startHistoryTask(startBlock, endBlock, callbackUrl, ctx.rpcClient, config, merge)

            ctx.response.body = {
                code: 200,
                message: 'history task started'
            }

            cache.set(cacheKey, true)
            systemOutput.debug('new support history registered', startBlock, endBlock, callbackUrl, merge)
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

            let cacheKey = sha256(JSON.stringify({
                callbackUrl: callbackUrl,
                merge: merge
            }))

            let cache = this.registerCache.get('support')
            if (cache.has(cacheKey)) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is already registered'
                }
                systemOutput.debug("callbackUrl is already registered for support endpoind", callbackUrl, merge)
                return
            }

            const mergeData = watchHeight(callbackUrl, ctx.monitor, false)

            watchTransferOut(ctx.monitor, callbackUrl.on_transfer_out, config, merge, mergeData)
            watchTransferIn(ctx.monitor, callbackUrl.on_transfer_in, config, merge, mergeData)
            watchConfirmOut(ctx.monitor, callbackUrl.on_confirm_out, config, merge, mergeData)
            watchConfirmIn(ctx.monitor, callbackUrl.on_confirm_in, config, merge, mergeData)
            watchRefundOut(ctx.monitor, callbackUrl.on_refunded_out, config, merge, mergeData)
            watchRefundIn(ctx.monitor, callbackUrl.on_refunded_in, config, merge, mergeData)

            ctx.response.body = {
                code: 200,
                message: 'register succeed'
            }

            cache.set(cacheKey, true)
            systemOutput.debug('new support registered', callbackUrl, merge)
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

            let cacheKey = sha256(JSON.stringify({
                startBlock: startBlock,
                endBlock: endBlock,
                callbackUrl: callbackUrl,
                merge: merge
            }))

            let cache = this.registerCache.get('support_reputation_history')
            if (cache.has(cacheKey)) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is already registered'
                }
                systemOutput.debug('callbackUrl is already registered for support reputation history endpoind', startBlock, endBlock, callbackUrl, merge)
                return
            }
            
            startReputationHistoryTask(startBlock, endBlock, callbackUrl, ctx.rpcClient, config, merge)

            ctx.response.body = {
                code: 200,
                message: 'history task started'
            }

            cache.set(cacheKey, true)
            systemOutput.debug('new support reputation history registered', startBlock, endBlock, callbackUrl, merge)
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

            let cacheKey = sha256(JSON.stringify({
                callbackUrl: callbackUrl,
                merge: merge
            }))

            let cache = this.registerCache.get('support_reputation')
            if (cache.has(cacheKey)) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is already registered'
                }
                systemOutput.debug("callbackUrl is already registered for support reputation endpoind", callbackUrl, merge)
                return
            }

            const mergeData = watchHeight(callbackUrl, ctx.monitor, true)
            
            watchReputation(ctx.monitor, callbackUrl.on_reputation, config, merge, mergeData)

            

            ctx.response.body = {
                code: 200,
                message: 'register succeed'
            }

            cache.set(cacheKey, true)
            systemOutput.debug('new support reputation registered', callbackUrl, merge)
        })
    }
    public get linkRouter() {
        return this._linkRouter
    }
    public set linkRouter(value) {
        this._linkRouter = value
    }
}