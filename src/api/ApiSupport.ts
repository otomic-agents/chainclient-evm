import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'
import { CallbackUrlBox, EvmConfig, EvmRpcClient } from '../interface/interface'
import Monitor from '../monitor/Monitor'
import { watchConfirmIn, watchConfirmOut, watchRefundIn, watchRefundOut, watchTransferIn, watchTransferOut } from '../serverUtils/WatcherFactory'
import needle from 'needle'

const watchHeight = (callbackUrl: CallbackUrlBox, monitor: Monitor) => {
    if (callbackUrl.on_height_update != undefined) {
        const on_height_update_url = callbackUrl.on_height_update
        monitor.watchHeight(
            {
                onHeightUpdate: (height) => {
                    try {
                        needle.post(on_height_update_url, 
                            {
                                type: 'update_height',
                                height: height
                            },
                            {
                                headers: {
                                    "Content-Type": "application/json"
                                }
                            },
                            (err, resp) => {
                            console.log('error:', err)
                            console.log('resp:', resp.body)
                        })
                    } catch (error) {
                        console.error(error)
                        return
                    }
                }
            }
        )
    }
}

const startHistoryTask = async (startBlock: number, endBlock: number, callbackUrl: CallbackUrlBox, client: EvmRpcClient, config: EvmConfig) => {
    const historyMonitor = new Monitor()
    historyMonitor.setConfigModeHistory(client, startBlock, endBlock)

    watchTransferOut(historyMonitor, callbackUrl.on_transfer_out, config)
    watchTransferIn(historyMonitor, callbackUrl.on_transfer_in, config)
    watchConfirmOut(historyMonitor, callbackUrl.on_confirm_out, config)
    watchConfirmIn(historyMonitor, callbackUrl.on_confirm_in, config)
    watchRefundOut(historyMonitor, callbackUrl.on_refunded_out, config)
    watchRefundIn(historyMonitor, callbackUrl.on_refunded_in, config)

    watchHeight(callbackUrl, historyMonitor)

    historyMonitor.historyModeStart()
}

export default class ApiSupport {
    linkRouter = (router: Router, config: EvmConfig) => {
        router.post(`/support/history`, async (ctx, next) => {
            console.log('on /support/history', ctx.request.body)

            const startBlock = (ctx.request.body as any).start
            const endBlock = (ctx.request.body as any).end
            const callbackUrl = (ctx.request.body as any).callback

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

            startHistoryTask(startBlock, endBlock, callbackUrl, ctx.rpcClient, config)

            ctx.response.body = {
                code: 200,
                message: 'history task started'
            }
        })

        router.post(`/support/register`, async (ctx, next) => {
            console.log('on /support/register', ctx.request.body)

            const callbackUrl = (ctx.request.body as any).callback

            if (callbackUrl == undefined) {
                ctx.response.body = {
                    code: 30209,
                    message: 'callbackUrl is a required parameter '
                }
                return
            }

            watchTransferOut(ctx.monitor, callbackUrl.on_transfer_out, config)
            watchTransferIn(ctx.monitor, callbackUrl.on_transfer_in, config)
            watchConfirmOut(ctx.monitor, callbackUrl.on_confirm_out, config)
            watchConfirmIn(ctx.monitor, callbackUrl.on_confirm_in, config)
            watchRefundOut(ctx.monitor, callbackUrl.on_refunded_out, config)
            watchRefundIn(ctx.monitor, callbackUrl.on_refunded_in, config)

            watchHeight(callbackUrl, ctx.monitor)

            ctx.response.body = {
                code: 200,
                message: 'register succeed'
            }
        })
    }
}