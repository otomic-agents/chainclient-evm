const {watchTransferOut, watchTransferIn, watchConfirm, watchRefund} = require('./Utils')
const Config = require('../config/Config')
const ethers = require('ethers')

class RelayApi {
    constructor(){}

    registerRelay = async (ctx, next) => {
        console.log('registerRelay')

        let relay_server_url = ctx.request.body.relay_server_url
        console.log('relay_server_url:', relay_server_url)

        if(relay_server_url == undefined){
            ctx.response.body = {
                code: 30207,
                message: 'relay_server_url not found'
            }
        } else {
            watchTransferOut(ctx.monitor, relay_server_url.on_transfer_out)
            watchTransferIn(ctx.monitor, relay_server_url.on_transfer_in)
            watchConfirm(ctx.monitor, relay_server_url.on_confirm)
            watchRefund(ctx.monitor, relay_server_url.on_refunded)
            ctx.response.body = {
                code: 200,
                message: 'register succeed'
            }
        }
        
    }

    getHashLock = async (ctx, next) => {
        console.log('getHashLock')

        let preimage = ctx.request.body.preimage
        console.log('preimage:', preimage)

        let hashlock = ethers.utils.keccak256(ethers.utils.solidityPack(['bytes32'], [preimage]))

        ctx.response.body = {
            code: 200,
            hashlock
        } 
    }

    getSystemFee = async (ctx, next) => {
        let provider = new ethers.providers.JsonRpcProvider(ctx.config.evm_config.rpc_url)
        let obridge = new ethers.Contract(ctx.config.evm_config.abi.obridge, this.evm_config.abi.obridge, provider)

        try {
            let base_points_rate = await obridge.basisPointsRate()

            ctx.response.body = {
                code: 200,
                fee: base_points_rate
            }
        } catch (error) {
            console.error(error)
            ctx.response.body = {
                code: 30206,
                message: 'fetch base_points_rate error'
            }
        }

    }
}

let relayApi = new RelayApi()

const exports_obj = {}
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/relay/register_relay`] = relayApi.registerRelay
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/relay/get_hashlock`] = relayApi.getHashLock
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/relay/get_system_fee`] = relayApi.getSystemFee

module.exports = exports_obj