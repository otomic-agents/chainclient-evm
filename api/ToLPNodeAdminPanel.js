const Config = require('../config/Config')

class LPNodeAdminPanelApi {
    constructor(){}

    setWallet = async (ctx, next) => {
        let wallets = ctx.request.body
        await ctx.wallet.updateWallet(wallets)
        ctx.response.body = await ctx.wallet.getWalletInfo()
    }
}

let lpnodeAdminPanelApi = new LPNodeAdminPanelApi()

const exports_obj = {}
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/lpnode_admin_panel/set_wallet`] = lpnodeAdminPanelApi.setWallet

module.exports = exports_obj