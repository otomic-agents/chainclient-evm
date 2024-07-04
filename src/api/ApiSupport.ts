import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'
import { CallbackUrlBox, EvmConfig, EvmRpcClient } from '../interface/interface'
import Monitor from '../monitor/Monitor'
import { watchConfirmIn, watchConfirmOut, watchRefundIn, watchRefundOut, watchReputation, watchTransferIn, watchTransferOut } from '../serverUtils/WatcherFactory'
import needle from 'needle'
import * as _ from "lodash"
import { systemOutput } from '../utils/systemOutput'
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
                onHeightUpdate: (heightIn) => {

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
                        try {
                            systemOutput.debug("send onHeightUpdate ", on_height_update_url);
                            needle.post(on_height_update_url, 
                                {
                                    type: 'update_height',
                                    height: height,
                                    data: blockNumberCache[height].data
                                },
                                {
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                },
                                (err, resp) => {
                                console.log('error:', err)
                                console.log('resp:', _.get(resp,"body",undefined) )
                            })
                        } catch (error) {
                            console.error(error)
                            return
                        }
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

            startHistoryTask(startBlock, endBlock, callbackUrl, ctx.rpcClient, config, merge)

            ctx.response.body = {
                code: 200,
                message: 'history task started'
            }
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

            startReputationHistoryTask(startBlock, endBlock, callbackUrl, ctx.rpcClient, config, merge)

            ctx.response.body = {
                code: 200,
                message: 'history task started'
            }
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

            const mergeData = watchHeight(callbackUrl, ctx.monitor, true)
            
            watchReputation(ctx.monitor, callbackUrl.on_reputation, config, merge, mergeData)

            

            ctx.response.body = {
                code: 200,
                message: 'register succeed'
            }
        })
    }
    public get linkRouter() {
        return this._linkRouter
    }
    public set linkRouter(value) {
        this._linkRouter = value
    }
}