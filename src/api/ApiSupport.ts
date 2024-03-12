import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'
import { EvmConfig, EvmRpcClient } from '../interface/interface'
import Monitor from '../monitor/Monitor'
import { watchConfirm, watchRefund, watchTransferIn, watchTransferOut } from '../serverUtils/WatcherFactory'
import needle from 'needle'

const startHistoryTask = async (startBlock: number, endBlock: number, callbackUrl: string, client: EvmRpcClient, config: EvmConfig) => {
    const historyMonitor = new Monitor()
    historyMonitor.setConfigModeHistory(client, startBlock, endBlock)

    watchTransferOut(historyMonitor, callbackUrl, config)
    watchTransferIn(historyMonitor, callbackUrl, config)
    watchConfirm(historyMonitor, callbackUrl, config)
    watchRefund(historyMonitor, callbackUrl, config)

    historyMonitor.watchHeight(
        {
            onHeightUpdate: (height) => {
                try {
                    needle.post(callbackUrl, 
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
    }
}