const { watchTransferOut, watchTransferIn, watchConfirm, watchRefund } = require('./Utils')
const { ethers } = require("ethers");
const Config = require('../config/Config')

const buildTransferIn = async (ctx, command_transfer_in, gas, obridge_iface) => {

    let wallet_address = await ctx.wallet.getAddress(command_transfer_in.sender_wallet_name)
    let calldata = obridge_iface.encodeFunctionData("transferIn", [
        wallet_address,                                                                     // address _sender,
        ethers.BigNumber.from(command_transfer_in.user_receiver_address).toHexString(),     // address _dstAddress,
        ethers.BigNumber.from(command_transfer_in.token).toHexString(),                     // address _token,
        command_transfer_in.token_amount,                                                   // uint256 _token_amount,
        command_transfer_in.eth_amount,                                                     // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_in.hash_lock),                               // bytes32 _hashlock,
        command_transfer_in.time_lock,                                                      // uint64 _timelock,
        command_transfer_in.src_chain_id,                                                   // uint64 _srcChainId,
        ethers.utils.arrayify(command_transfer_in.src_transfer_id),                         // bytes32 _srcTransferId
    ])

    let transactionRequest = {
        to: ctx.config.evm_config.contract_address,
        from: wallet_address,
        // nonce       : undefined,
        data: calldata,
        value: command_transfer_in.eth_amount + '',
        // gasLimit    : 21000,
        gasPrice: gas.gas_price,
        chainId: ctx.config.evm_config.chain_id,
        // Content to be optimized
        // maxFeePerGas            :'',
        // maxPriorityFeePerGas    :'',
        // type                    :'',
        // accessList              :''
    }

    transactionRequest.rawData = command_transfer_in

    return transactionRequest
}

const buildTransferConfirm = async (ctx, command_transfer_confirm, gas, obridge_iface) => {

    let wallet_address = await ctx.wallet.getAddress(command_transfer_confirm.sender_wallet_name)
    let calldata = obridge_iface.encodeFunctionData("confirm", [
        wallet_address,                                                                             // address _sender,
        ethers.BigNumber.from(command_transfer_confirm.user_receiver_address).toHexString(),        // address _receiver,
        ethers.BigNumber.from(command_transfer_confirm.token).toHexString(),                        // address _token,
        command_transfer_confirm.token_amount,                                                      // uint256 _token_amount,
        command_transfer_confirm.eth_amount,                                                        // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_confirm.hash_lock),                                  // bytes32 _hashlock,
        command_transfer_confirm.time_lock,                                                         // uint64 _timelock,
        ethers.utils.arrayify(command_transfer_confirm.preimage),                                   // bytes32 _preimage
    ])

    let transactionRequest = {
        to: ctx.config.evm_config.contract_address,
        from: wallet_address,
        // nonce       : undefined,
        data: calldata,
        value: 0,
        // gasLimit    : 21000,
        gasPrice: gas.gas_price,
        chainId: ctx.config.evm_config.chain_id,
        // Content to be optimized
        // maxFeePerGas            :'',
        // maxPriorityFeePerGas    :'',
        // type                    :'',
        // accessList              :''
    }

    return transactionRequest
}

const buildTransferRefund = async (ctx, command_transfer_refund, gas, obridge_iface) => {

    let wallet_address = await ctx.wallet.getAddress(command_transfer_refund.sender_wallet_name)
    let calldata = obridge_iface.encodeFunctionData("refund", [
        wallet_address,                                                                             // address _sender,
        ethers.BigNumber.from(command_transfer_refund.user_receiver_address).toHexString(),         // address _receiver,
        ethers.BigNumber.from(command_transfer_refund.token).toHexString(),                         // address _token,
        command_transfer_refund.token_amount,                                                       // uint256 _token_amount,
        command_transfer_refund.eth_amount,                                                         // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_refund.hash_lock),                                   // bytes32 _hashlock,
        command_transfer_refund.time_lock,                                                          // uint64 _timelock,
    ])

    let transactionRequest = {
        to: ctx.config.evm_config.contract_address,
        from: wallet_address,
        // nonce       : undefined,
        data: calldata,
        value: 0,
        // gasLimit    : 21000,
        gasPrice: gas.gas_price,
        chainId: ctx.config.evm_config.chain_id,
        // Content to be optimized
        // maxFeePerGas            :'',
        // maxPriorityFeePerGas    :'',
        // type                    :'',
        // accessList              :''
    }

    return transactionRequest
}

const forwardToTransactionManager = (ctx, transaction, transaction_type) => {

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

class LPNodeApi {
    constructor() { }

    registerLPNode = async (ctx, next) => {
        console.log('registerLPNode')

        if (this.obridge_iface == undefined) {
            this.obridge_iface = new ethers.utils.Interface(ctx.config.evm_config.abi.obridge)

            console.log('config:')
            console.log(ctx.config.evm_config)

            console.log('obridge_iface:')
            console.log(this.obridge_iface)
        }

        let lpnode_server_url = ctx.request.body.lpnode_server_url
        console.log('lpnode_server_url:', lpnode_server_url)

        if (lpnode_server_url == undefined) {
            ctx.response.body = {
                code: 30207,
                message: 'lpnode_server_url not found'
            }
        } else {
            watchTransferOut(ctx.monitor, lpnode_server_url.on_transfer_out)
            watchTransferIn(ctx.monitor, lpnode_server_url.on_transfer_in)
            watchConfirm(ctx.monitor, lpnode_server_url.on_confirm)
            watchRefund(ctx.monitor, lpnode_server_url.on_refunded)
            ctx.response.body = {
                code: 200,
                message: 'register succeed'
            }
        }
    }

    transferIn = async (ctx, next) => {
        let transaction_type = ctx.request.body.transaction_type
        let command_transfer_in = ctx.request.body.command_transfer_in
        let gas = ctx.request.body.gas

        console.log("on transfer in")
        console.log("transaction_type:", transaction_type)
        console.log("command_transfer_in:")
        console.log(command_transfer_in)
        console.log("gas:")
        console.log(gas)

        let transaction = await buildTransferIn(ctx, command_transfer_in, gas, this.obridge_iface)

        forwardToTransactionManager(ctx, transaction, transaction_type)

        ctx.response.body = {
            code: 200,
            message: 'Command received'
        }
    }

    confirm = async (ctx, next) => {
        let transaction_type = ctx.request.body.transaction_type
        let command_transfer_confirm = ctx.request.body.command_transfer_in_confirm
        let gas = ctx.request.body.gas

        console.log("on confirm in")
        console.log("transaction_type:", transaction_type)
        console.log("command_transfer_confirm:")
        console.log(command_transfer_confirm)
        console.log("gas:")
        console.log(gas)

        let transaction = await buildTransferConfirm(ctx, command_transfer_confirm, gas, this.obridge_iface)

        forwardToTransactionManager(ctx, transaction, transaction_type)

        ctx.response.body = {
            code: 200,
            message: 'Command received'
        }
    }

    refund = async (ctx, next) => {

        console.log('on refund')
        console.log(ctx.request.body)

        let transaction_type = ctx.request.body.transaction_type
        let command_transfer_refund = ctx.request.body.command_transfer_refund
        let gas = ctx.request.body.gas

        let transaction = await buildTransferRefund(ctx, command_transfer_refund, gas, this.obridge_iface)

        forwardToTransactionManager(ctx, transaction, transaction_type)

        ctx.response.body = {
            code: 200,
            message: 'Command received'
        }
    }

    getWallets = async (ctx, next) => {
        let code = 500;
        let wallet_info;
        try {
            wallet_info = await ctx.wallet.getWalletInfo()
            code = 200;
        } catch (e) {
            console.error(e)
        } finally {
            ctx.response.body = {
                code: code,
                data: wallet_info
            }
        }
    }

    balanceOf = async (ctx, next) => {

    }
}

let lpnodeApi = new LPNodeApi()

const exports_obj = {}
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/lpnode/register_lpnode`] = lpnodeApi.registerLPNode
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/lpnode/transfer_in`] = lpnodeApi.transferIn
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/lpnode/refund`] = lpnodeApi.refund
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/lpnode/confirm`] = lpnodeApi.confirm
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/lpnode/get_wallets`] = lpnodeApi.getWallets
exports_obj[`POST /evm-client-${Config.evm_config.system_chain_id}/lpnode/balance_of`] = lpnodeApi.balanceOf

module.exports = exports_obj