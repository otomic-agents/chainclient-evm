import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'
import { EvmConfig } from '../interface/interface'
import { watchConfirmIn, watchConfirmOut, watchRefundIn, watchRefundOut, watchTransferIn, watchTransferOut } from '../serverUtils/WatcherFactory'
import { ethers } from 'ethers'

const domain = {
    name: 'OtmoicSwap',
    version: '1',
    chainId: 1,
};
  
const types = {
    Message: [
        { name: 'lp_id', type: 'string' },
        { name: 'amount', type: 'string' },
        { name: 'bridge_name', type: 'string' },
        { name: 'sender', type: 'string' },
        { name: 'time_lock', type: 'string' },
        { name: 'dst_address', type: 'string' },
        { name: 'dst_amount', type: 'string' },
        { name: 'dst_native_amount', type: 'string' },
        { name: 'sub', type: 'string' },
    ],
};

const verifySignature = (signature: any, value: any) => {
    const recoveredAddress = ethers.utils.verifyTypedData(domain, types, value, signature);
    
    console.log('Recovered Address:', recoveredAddress);
    return recoveredAddress
};

export default class ApiForRelay{
    linkRouter = (router: Router, config: EvmConfig) => {

        router.post(`/evm-client-${config.system_chain_id}/relay/register_relay`, async (ctx, next) => {
            console.log('registerRelay')

            let relay_server_url = (ctx.request.body as any).relay_server_url
            console.log('relay_server_url:', relay_server_url)
    
            if(relay_server_url == undefined){
                ctx.response.body = {
                    code: 30207,
                    message: 'relay_server_url not found'
                }
            } else {
                watchTransferOut(ctx.monitor, relay_server_url.on_transfer_out, config, false, undefined)
                watchTransferIn(ctx.monitor, relay_server_url.on_transfer_in, config, false, undefined)
                watchConfirmOut(ctx.monitor, relay_server_url.on_confirm_out, config, false, undefined)
                watchConfirmIn(ctx.monitor, relay_server_url.on_confirm_in, config, false, undefined)
                watchRefundOut(ctx.monitor, relay_server_url.on_refunded_out, config, false, undefined)
                watchRefundIn(ctx.monitor, relay_server_url.on_refunded_in, config, false, undefined)
                ctx.response.body = {
                    code: 200,
                    message: 'register succeed'
                }
            }
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/get_hashlock`, async (ctx, next) => {
            console.log('getHashLock')

            let preimage = (ctx.request.body as any).preimage
            console.log('preimage:', preimage)
    
            let hashlock = ethers.utils.keccak256(ethers.utils.solidityPack(['bytes32'], [preimage]))
    
            ctx.response.body = {
                code: 200,
                hashlock
            } 
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/get_system_fee`, async (ctx, next) => {
            let provider = new ethers.providers.JsonRpcProvider(ctx.config.evm_config.rpc_url)
            let obridge = new ethers.Contract(ctx.config.evm_config.contract_address, ctx.config.evm_config.abi.obridge, provider)
    
            try {
                let base_points_rate = await obridge.basisPointsRate()
    
                ctx.response.body = {
                    code: 200,
                    fee: base_points_rate.toNumber()
                }
            } catch (error) {
                console.error(error)
                ctx.response.body = {
                    code: 30206,
                    message: 'fetch base_points_rate error'
                }
            }
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/get_signer_from_eip712`, async (ctx, next) => {
            const signature = (ctx.request.body as any).signature
            const value = (ctx.request.body as any).value

            const address = verifySignature(signature, value)

            ctx.response.body = {
                code: 200,
                address
            } 
        })
    }
}