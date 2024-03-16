import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'
import { CommandTransferConfirm, CommandTransferOutConfirm, CommandTransferOutRefund, CommandTransferRefund, EvmConfig, GasInfo, KoaCtx, TransactionRequestCC } from '../interface/interface'
import { watchConfirmIn, watchConfirmOut, watchRefundIn, watchRefundOut, watchTransferIn, watchTransferOut } from '../serverUtils/WatcherFactory'
import { ethers } from 'ethers'
import { arrayify } from 'ethers/lib/utils';

const domain = {
    name: 'OtmoicSwap',
    version: '1',
    chainId: 1
};
  
const types = {
    Message: [
        { name: 'src_chain_id', type: 'uint256' },
        { name: 'src_address', type: 'string' },
        { name: 'src_token', type: 'string' },
        { name: 'src_amount', type: 'string' },
        { name: 'dst_chain_id', type: 'uint256' },
        { name: 'dst_address', type: 'string' },
        { name: 'dst_token', type: 'string' },
        { name: 'dst_amount', type: 'string' },
        { name: 'dst_native_amount', type: 'string' },
        { name: 'requestor', type: 'string' },
        { name: 'lp_id', type: 'string' },
        { name: 'step_time_lock', type: 'uint256' },
        { name: 'agreement_reached_time', type: 'uint256' },
    ],
};

const verifySignature = (signature: any, value: any, chainId: number) => {
    domain.chainId = chainId

    const sigBuffer = ethers.utils.arrayify(signature);
    const fixedSignature = ethers.utils.splitSignature(sigBuffer);

    // version 1
    console.log('domain', domain)
    console.log('types', types)
    console.log('value', value)
    const recoveredAddress = ethers.utils.verifyTypedData(domain, types, value, fixedSignature);

    console.log('Recovered Address:', recoveredAddress);
    return recoveredAddress
};

const buildTransferInConfirm = async (ctx: KoaCtx, command_transfer_confirm: CommandTransferConfirm, gas: GasInfo, obridgeIface: ethers.utils.Interface): Promise<TransactionRequestCC> => {

    // let wallet_address = await ctx.wallet.getAddress(command_transfer_confirm.sender_wallet_name)
    let calldata = obridgeIface.encodeFunctionData("confirmTransferIn", [
        command_transfer_confirm.sender,                                                                             // address _sender,
        ethers.BigNumber.from(command_transfer_confirm.user_receiver_address).toHexString(),        // address _receiver,
        ethers.BigNumber.from(command_transfer_confirm.token).toHexString(),                        // address _token,
        command_transfer_confirm.token_amount,                                                      // uint256 _token_amount,
        command_transfer_confirm.eth_amount,                                                        // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_confirm.hash_lock),                                  // bytes32 _hashlock,
        command_transfer_confirm.step_time_lock,                                                    // uint64 _timelock,
        ethers.utils.arrayify(command_transfer_confirm.preimage),                                   // bytes32 _preimage
        command_transfer_confirm.agreement_reached_time
    ])

    let transactionRequest: TransactionRequestCC = {
        to: ctx.config.evm_config.contract_address,
        from: await ctx.wallet.getRelayAddress(),
        data: calldata,
        value: 0 + '',
        gasPrice: gas.gas_price,
        chainId: ctx.config.evm_config.chain_id,

        rawData: undefined,
        transactionHash: undefined,
        gasLimit: undefined,
        nonce: undefined,
        transactionReceipt: undefined,
        sended: undefined,
        error: undefined
    }

    return transactionRequest
}

const buildTransferInRefund = async (ctx: KoaCtx, command_transfer_refund: CommandTransferRefund, gas: GasInfo, obridgeIface: ethers.utils.Interface): Promise<TransactionRequestCC> => {

    let wallet_address = await ctx.wallet.getAddress(command_transfer_refund.sender_wallet_name)
    let calldata = obridgeIface.encodeFunctionData("refundTransferIn", [
        wallet_address,                                                                             // address _sender,
        ethers.BigNumber.from(command_transfer_refund.user_receiver_address).toHexString(),         // address _receiver,
        ethers.BigNumber.from(command_transfer_refund.token).toHexString(),                         // address _token,
        command_transfer_refund.token_amount,                                                       // uint256 _token_amount,
        command_transfer_refund.eth_amount,                                                         // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_refund.hash_lock),                                   // bytes32 _hashlock,
        command_transfer_refund.step_time_lock,                                                     // uint64 _timelock,
        command_transfer_refund.agreement_reached_time
    ])

    let transactionRequest: TransactionRequestCC = {
        to: ctx.config.evm_config.contract_address,
        from: wallet_address,
        data: calldata,
        value: 0 + '',
        gasPrice: gas.gas_price,
        chainId: ctx.config.evm_config.chain_id,

        rawData: undefined,
        transactionHash: undefined,
        gasLimit: undefined,
        nonce: undefined,
        transactionReceipt: undefined,
        sended: undefined,
        error: undefined
    }

    return transactionRequest
}

const buildTransferOutConfirm = async (ctx: KoaCtx, command_transfer_confirm: CommandTransferOutConfirm, gas: GasInfo, obridgeIface: ethers.utils.Interface): Promise<TransactionRequestCC> => {

    let calldata = obridgeIface.encodeFunctionData("confirmTransferOut", [
        command_transfer_confirm.sender,                                                                          // address _sender,
        ethers.BigNumber.from(command_transfer_confirm.user_receiver_address).toHexString(),        // address _receiver,
        ethers.BigNumber.from(command_transfer_confirm.token).toHexString(),                        // address _token,
        command_transfer_confirm.token_amount,                                                      // uint256 _token_amount,
        command_transfer_confirm.eth_amount,                                                        // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_confirm.hash_lock),                                  // bytes32 _hashlock,
        ethers.utils.arrayify(command_transfer_confirm.relay_hash_lock),                                  
        command_transfer_confirm.step_time_lock,                                                    // uint64 _timelock,
        ethers.utils.arrayify(command_transfer_confirm.preimage),                                   // bytes32 _preimage
        ethers.utils.arrayify(command_transfer_confirm.relay_preimage),  
        command_transfer_confirm.agreement_reached_time
    ])

    let transactionRequest: TransactionRequestCC = {
        to: ctx.config.evm_config.contract_address,
        from: await ctx.wallet.getRelayAddress(),
        data: calldata,
        value: 0 + '',
        gasPrice: gas.gas_price,
        chainId: ctx.config.evm_config.chain_id,

        rawData: undefined,
        transactionHash: undefined,
        gasLimit: undefined,
        nonce: undefined,
        transactionReceipt: undefined,
        sended: undefined,
        error: undefined
    }

    return transactionRequest
}

const buildTransferOutRefund = async (ctx: KoaCtx, command_transfer_refund: CommandTransferOutRefund, gas: GasInfo, obridgeIface: ethers.utils.Interface): Promise<TransactionRequestCC> => {

    
    let calldata = obridgeIface.encodeFunctionData("refundTransferOut", [
        command_transfer_refund.sender,                                                                             // address _sender,
        ethers.BigNumber.from(command_transfer_refund.user_receiver_address).toHexString(),         // address _receiver,
        ethers.BigNumber.from(command_transfer_refund.token).toHexString(),                         // address _token,
        command_transfer_refund.token_amount,                                                       // uint256 _token_amount,
        command_transfer_refund.eth_amount,                                                         // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_refund.hash_lock),                                   // bytes32 _hashlock,
        command_transfer_refund.step_time_lock,                                                     // uint64 _timelock,
        command_transfer_refund.agreement_reached_time
    ])

    let transactionRequest: TransactionRequestCC = {
        to: ctx.config.evm_config.contract_address,
        from: await ctx.wallet.getRelayAddress(),
        data: calldata,
        value: 0 + '',
        gasPrice: gas.gas_price,
        chainId: ctx.config.evm_config.chain_id,

        rawData: undefined,
        transactionHash: undefined,
        gasLimit: undefined,
        nonce: undefined,
        transactionReceipt: undefined,
        sended: undefined,
        error: undefined
    }

    return transactionRequest
}

const forwardToTransactionManager = (ctx: KoaCtx, transaction: TransactionRequestCC, transaction_type: string) => {

    console.group("on forwardToTransactionManager")
    console.log("transaction")
    console.log(transaction)
    console.log("transaction_type")
    console.log(transaction_type)
    console.groupEnd()

    switch (transaction_type) {
        case "LOCAL_PADDING":
            ctx.transactionManager.sendTransactionLocalPadding(transaction)
            break;
        case "CHAIN_PADDING":
            ctx.transactionManager.sendTransactionChainPadding(transaction)
            break;
        case "FASTEST":
            ctx.transactionManager.sendTransactionFastest(transaction)
            break;
        default:
            break;
    }
}

export default class ApiForRelay{

    obridgeIface: ethers.utils.Interface | undefined

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

            console.log('on get_signer_from_eip712')
            console.log('signature', signature)
            console.log('value', value)
            let address = '0x0'
            try {
                address = verifySignature(signature, value, parseInt(config.chain_id))
            } catch (error) {
                console.error(error)
            }

            ctx.response.body = {
                code: 200,
                address
            } 
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/behalf/confirm_out`, async (ctx, next) => {
            let transaction_type = (ctx.request.body as any).transaction_type
            let command_transfer_confirm = (ctx.request.body as any).command_transfer_in_confirm
            let gas = (ctx.request.body as any).gas
    
            console.log("on confirm out")
            console.log("transaction_type:", transaction_type)
            console.log("command_transfer_confirm:")
            console.log(command_transfer_confirm)
            console.log("gas:")
            console.log(gas)
    
            if (this.obridgeIface == undefined) {
                this.obridgeIface = new ethers.utils.Interface(ctx.config.evm_config.abi.obridge)
                // ctx.response.body = {
                //     code: 30208,
                //     message: 'obridgeIface not found'
                // }
                // return
            }
            let transaction = await buildTransferOutConfirm(ctx, command_transfer_confirm, gas, this.obridgeIface)
    
            forwardToTransactionManager(ctx, transaction, transaction_type)
    
            ctx.response.body = {
                code: 200,
                message: 'Command received'
            }
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/behalf/confirm_in`, async (ctx, next) => {
            let transaction_type = (ctx.request.body as any).transaction_type
            let command_transfer_confirm = (ctx.request.body as any).command_transfer_in_confirm
            let gas = (ctx.request.body as any).gas
    
            console.log("on confirm in")
            console.log("transaction_type:", transaction_type)
            console.log("command_transfer_confirm:")
            console.log(command_transfer_confirm)
            console.log("gas:")
            console.log(gas)
    
            if (this.obridgeIface == undefined) {
                this.obridgeIface = new ethers.utils.Interface(ctx.config.evm_config.abi.obridge)
                // ctx.response.body = {
                //     code: 30208,
                //     message: 'obridgeIface not found'
                // }
                // return
            }
            let transaction = await buildTransferInConfirm(ctx, command_transfer_confirm, gas, this.obridgeIface)
    
            forwardToTransactionManager(ctx, transaction, transaction_type)
    
            ctx.response.body = {
                code: 200,
                message: 'Command received'
            }
        })
        
        router.post(`/evm-client-${config.system_chain_id}/relay/behalf/refund_out`, async (ctx, next) => {
            console.log('on refund out')
            console.log(ctx.request.body)
    
            let transaction_type = (ctx.request.body as any).transaction_type
            let command_transfer_refund = (ctx.request.body as any).command_transfer_refund
            let gas = (ctx.request.body as any).gas
    
            if (this.obridgeIface == undefined) {
                this.obridgeIface = new ethers.utils.Interface(ctx.config.evm_config.abi.obridge)
                // ctx.response.body = {
                //     code: 30208,
                //     message: 'obridgeIface not found'
                // }
                // return
            }
            let transaction = await buildTransferOutRefund(ctx, command_transfer_refund, gas, this.obridgeIface)
    
            forwardToTransactionManager(ctx, transaction, transaction_type)
    
            ctx.response.body = {
                code: 200,
                message: 'Command received'
            }
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/behalf/refund_in`, async (ctx, next) => {
            console.log('on refund in')
            console.log(ctx.request.body)
    
            let transaction_type = (ctx.request.body as any).transaction_type
            let command_transfer_refund = (ctx.request.body as any).command_transfer_refund
            let gas = (ctx.request.body as any).gas
    
            if (this.obridgeIface == undefined) {
                this.obridgeIface = new ethers.utils.Interface(ctx.config.evm_config.abi.obridge)
                // ctx.response.body = {
                //     code: 30208,
                //     message: 'obridgeIface not found'
                // }
                // return
            }
            let transaction = await buildTransferInRefund(ctx, command_transfer_refund, gas, this.obridgeIface)
    
            forwardToTransactionManager(ctx, transaction, transaction_type)
    
            ctx.response.body = {
                code: 200,
                message: 'Command received'
            }
        })
    }
}