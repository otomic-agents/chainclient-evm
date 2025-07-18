import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'
import { EvmConfig } from '../interface/interface'
import { SystemOut } from '../utils/systemOut'

export default class ApiForLpAdmin {
    linkRouter = (router: Router, config: EvmConfig) => {

        router.post(`/evm-client-${config.system_chain_id}/lpnode_admin_panel/set_wallet`, async (ctx, next) => {
            const wallets = ctx.request.body
            await ctx.wallet.updateWallet(wallets)
            await ctx.wallet.getWalletInfo(true)
            
            ctx.response.body = {
                code: 0,
                message:"set ok"
            }
        })
    }
}