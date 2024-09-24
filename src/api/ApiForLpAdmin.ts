import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'
import { EvmConfig } from '../interface/interface'

export default class ApiForLpAdmin {
    linkRouter = (router: Router, config: EvmConfig) => {

        router.post(`/evm-client-${config.system_chain_id}/lpnode_admin_panel/set_wallet`, async (ctx, next) => {
            const wallets = ctx.request.body
            await ctx.wallet.updateWallet(wallets)
            ctx.response.body = await ctx.wallet.getWalletInfo(true)
        })
    }
}