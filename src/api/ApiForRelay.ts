import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'
const ethUtil = require('ethereumjs-util');
const keythereum = require('keythereum');
const fs = require('fs');
const keystore = JSON.parse(fs.readFileSync('/home/coder/keystore/relay_9006_keystore/keystore', 'utf8'));
import * as _ from "lodash"
const password = '1Q2Q3Q4Q8Q';

import { CommandRefundSwap, CommandTransferConfirm, CommandTransferOutConfirm, CommandTransferOutRefund, CommandTransferRefund, EvmConfig, GasInfo, KoaCtx, TransactionRequestCC } from '../interface/interface'
import { watchConfirmIn, watchConfirmOut, watchRefundIn, watchRefundOut, watchTransferIn, watchTransferOut } from '../serverUtils/WatcherFactory'
import { ethers } from 'ethers'
import { arrayify } from 'ethers/lib/utils';
import { TransactionHelper } from '../utils/transactionHelper'
import { SystemOut } from '../utils/systemOut'
const AddressZero = "0x0000000000000000000000000000000000000000";
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
        { name: 'agreement_reached_time', type: 'uint256' },
        { name: 'expected_single_step_time', type: 'uint256' },
        { name: 'tolerant_single_step_time', type: 'uint256' },
        { name: 'earliest_refund_time', type: 'uint256' },
    ],
};

const typesSingleSwap = {
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
        { name: 'agreement_reached_time', type: 'uint256' },
        { name: 'expected_single_step_time', type: 'uint256' }
    ],
}

const verifySignature = (signature: any, value: any, chainId: number) => {
    domain.chainId = chainId

    const sigBuffer = ethers.utils.arrayify(signature);
    const fixedSignature = ethers.utils.splitSignature(sigBuffer);
    SystemOut.debug("signature", signature)
    // version 1
    SystemOut.debug('domain', domain)
    SystemOut.debug('types', types)
    SystemOut.debug('value', value)
    const recoveredAddress = ethers.utils.verifyTypedData(domain, types, value, fixedSignature);

    SystemOut.debug('Recovered Address:', recoveredAddress);
    return recoveredAddress
};


const verifySignatureSingleSwap = (signature: any, value: any, chainId: number) => {
    domain.chainId = chainId

    const sigBuffer = ethers.utils.arrayify(signature);
    const fixedSignature = ethers.utils.splitSignature(sigBuffer);
    SystemOut.debug("signature", signature)
    // version 1
    SystemOut.debug('domain', domain)
    SystemOut.debug('types', typesSingleSwap)
    SystemOut.debug('value', value)
    const recoveredAddress = ethers.utils.verifyTypedData(domain, typesSingleSwap, value, fixedSignature);

    SystemOut.debug('Recovered Address:', recoveredAddress);
    return recoveredAddress
};

const buildTransferInConfirm = async (ctx: KoaCtx, command_transfer_confirm: CommandTransferConfirm, gas: GasInfo, obridgeIface: ethers.utils.Interface): Promise<TransactionRequestCC> => {

    // let wallet_address = await ctx.wallet.getAddress(command_transfer_confirm.sender_wallet_name)
    let token = ethers.BigNumber.from(command_transfer_confirm.token).toHexString(); // address
    let targetIsNativeToken = false;
    if (
        ethers.BigNumber.from(command_transfer_confirm.token).toHexString() == "0x00"
    ) {
        token = AddressZero;
        targetIsNativeToken = true;
    }
    const calldata = obridgeIface.encodeFunctionData("confirmTransferIn", [
        command_transfer_confirm.sender,                                                                             // address _sender,
        ethers.BigNumber.from(command_transfer_confirm.user_receiver_address).toHexString(),        // address _receiver,
        token,                        // address _token,
        command_transfer_confirm.token_amount,                                                      // uint256 _token_amount,
        command_transfer_confirm.eth_amount,                                                        // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_confirm.hash_lock),                                  // bytes32 _hashlock,
        command_transfer_confirm.expected_single_step_time, // _expectedSingleStepTime (uint64)
        command_transfer_confirm.tolerant_single_step_time, // _tolerantSingleStepTime (uint64)
        command_transfer_confirm.earliest_refund_time, // _earliestRefundTime (uint64)                                                // uint64 _timelock,
        ethers.utils.arrayify(command_transfer_confirm.preimage),                                   // bytes32 _preimage
        command_transfer_confirm.agreement_reached_time
    ])

    const transactionRequest: TransactionRequestCC = {
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
const abi = [{ "inputs": [{ "internalType": "string", "name": "op", "type": "string" }, { "internalType": "uint64", "name": "expiredAt", "type": "uint64" }], "name": "ExpiredOp", "type": "error" }, { "inputs": [], "name": "FailedToSendEther", "type": "error" }, { "inputs": [], "name": "InvalidAmount", "type": "error" }, { "inputs": [], "name": "InvalidSender", "type": "error" }, { "inputs": [], "name": "InvalidStatus", "type": "error" }, { "inputs": [{ "internalType": "string", "name": "op", "type": "string" }, { "internalType": "uint64", "name": "lockedUntil", "type": "uint64" }], "name": "NotUnlock", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "bytes32", "name": "transferId", "type": "bytes32" }, { "indexed": false, "internalType": "address", "name": "sender", "type": "address" }, { "indexed": false, "internalType": "address", "name": "receiver", "type": "address" }, { "indexed": false, "internalType": "address", "name": "srcToken", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "srcAmount", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "dstToken", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "dstAmount", "type": "uint256" }, { "indexed": false, "internalType": "uint64", "name": "stepTime", "type": "uint64" }, { "indexed": false, "internalType": "uint64", "name": "agreementReachedTime", "type": "uint64" }, { "indexed": false, "internalType": "bytes32", "name": "bidId", "type": "bytes32" }, { "indexed": false, "internalType": "string", "name": "requestor", "type": "string" }, { "indexed": false, "internalType": "string", "name": "lpId", "type": "string" }, { "indexed": false, "internalType": "string", "name": "userSign", "type": "string" }, { "indexed": false, "internalType": "string", "name": "lpSign", "type": "string" }], "name": "LogInitSwap", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "bytes32", "name": "transferId", "type": "bytes32" }], "name": "LogSwapConfirmed", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "bytes32", "name": "transferId", "type": "bytes32" }], "name": "LogSwapRefunded", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" }, { "inputs": [], "name": "approveOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "basisPointsRate", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_sender", "type": "address" }, { "internalType": "address", "name": "_receiver", "type": "address" }, { "internalType": "address", "name": "_srcToken", "type": "address" }, { "internalType": "uint256", "name": "_srcAmount", "type": "uint256" }, { "internalType": "address", "name": "_dstToken", "type": "address" }, { "internalType": "uint256", "name": "_dstAmount", "type": "uint256" }, { "internalType": "uint64", "name": "_stepTime", "type": "uint64" }, { "internalType": "uint64", "name": "_agreementReachedTime", "type": "uint64" }], "name": "confirmSwap", "outputs": [], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_sender", "type": "address" }, { "internalType": "address", "name": "_receiver", "type": "address" }, { "internalType": "address", "name": "_srcToken", "type": "address" }, { "internalType": "uint256", "name": "_srcAmount", "type": "uint256" }, { "internalType": "address", "name": "_dstToken", "type": "address" }, { "internalType": "uint256", "name": "_dstAmount", "type": "uint256" }, { "internalType": "uint64", "name": "_stepTime", "type": "uint64" }, { "internalType": "uint64", "name": "_agreementReachedTime", "type": "uint64" }, { "internalType": "bytes32", "name": "_bidId", "type": "bytes32" }, { "internalType": "string", "name": "_requestor", "type": "string" }, { "internalType": "string", "name": "_lpId", "type": "string" }, { "internalType": "string", "name": "_userSign", "type": "string" }, { "internalType": "string", "name": "_lpSign", "type": "string" }], "name": "initSwap", "outputs": [], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "maximumFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "nextOwner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_sender", "type": "address" }, { "internalType": "address", "name": "_receiver", "type": "address" }, { "internalType": "address", "name": "_srcToken", "type": "address" }, { "internalType": "uint256", "name": "_srcAmount", "type": "uint256" }, { "internalType": "address", "name": "_dstToken", "type": "address" }, { "internalType": "uint256", "name": "_dstAmount", "type": "uint256" }, { "internalType": "uint64", "name": "_stepTime", "type": "uint64" }, { "internalType": "uint64", "name": "_agreementReachedTime", "type": "uint64" }], "name": "refundSwap", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "rate", "type": "uint256" }], "name": "setBasisPointsRate", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "fee", "type": "uint256" }], "name": "setMaximumFee", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "toll", "type": "address" }], "name": "setTollAddress", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "name": "swapStatus", "outputs": [{ "internalType": "enum OtmoicSwap.TransferStatus", "name": "transferStatus", "type": "uint8" }, { "internalType": "uint256", "name": "srcTokenFee", "type": "uint256" }, { "internalType": "uint256", "name": "dstTokenFee", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "tollAddress", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "stateMutability": "payable", "type": "receive" }];
const buildRefundSwap = async (ctx: KoaCtx,
    command_refund_swap: CommandRefundSwap,
    gas: GasInfo,
    obridgeIface: ethers.utils.Interface) => {
    const iface = new ethers.utils.Interface(abi);
    command_refund_swap.sender_wallet_name = await ctx.wallet.getRelayWalletName()
    const params = [
        command_refund_swap.sender,
        command_refund_swap.user_receiver_address,
        command_refund_swap.token,
        command_refund_swap.token_amount,
        command_refund_swap.dst_token,
        command_refund_swap.dst_amount,
        command_refund_swap.expected_single_step_time,
        command_refund_swap.agreement_reached_time,
    ];
    console.log(params)
    const calldata = iface.encodeFunctionData("refundSwap", params)
    console.log("Encoded parameters:", params);


    console.log(params)

    console.log("calldata")
    const transactionRequest: TransactionRequestCC = {
        to: "0x22dD71312bC00823634676EEe5B289936E0B54c1",
        from: await ctx.wallet.getRelayAddress(),
        data: calldata,
        value: 0 + "",
        gasPrice: gas.gas_price,
        chainId: ctx.config.evm_config.chain_id,

        rawData: undefined,
        transactionHash: undefined,
        gasLimit: undefined,
        nonce: undefined,
        transactionReceipt: undefined,
        sended: undefined,
        error: undefined,
    };
    transactionRequest.rawData = command_refund_swap;
    // @ts-ignore
    transactionRequest.rawData.token = command_refund_swap.dst_token;
    return transactionRequest;
}
const buildTransferInRefund = async (ctx: KoaCtx, command_transfer_refund: CommandTransferRefund, gas: GasInfo, obridgeIface: ethers.utils.Interface): Promise<TransactionRequestCC> => {

    const wallet_address = await ctx.wallet.getAddress(command_transfer_refund.sender_wallet_name)
    let token = ethers.BigNumber.from(command_transfer_refund.token).toHexString(); // address
    let targetIsNativeToken = false;
    if (
        ethers.BigNumber.from(command_transfer_refund.token).toHexString() == "0x00"
    ) {
        token = AddressZero;
        targetIsNativeToken = true;
    }
    const calldata = obridgeIface.encodeFunctionData("refundTransferIn", [
        wallet_address,                                                                             // address _sender,
        ethers.BigNumber.from(command_transfer_refund.user_receiver_address).toHexString(),         // address _receiver,
        token,                         // address _token,
        command_transfer_refund.token_amount,                                                       // uint256 _token_amount,
        command_transfer_refund.eth_amount,                                                         // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_refund.hash_lock),                                   // bytes32 _hashlock,
        command_transfer_refund.expected_single_step_time, // _expectedSingleStepTime (uint64)
        command_transfer_refund.tolerant_single_step_time, // _tolerantSingleStepTime (uint64)
        command_transfer_refund.earliest_refund_time, // _earliestRefundTime (uint64)
        command_transfer_refund.agreement_reached_time
    ])

    const transactionRequest: TransactionRequestCC = {
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
// const contractArgs = [
//     quoteConfirmResponse.pre_business.swap_asset_information.sender,
//     quoteConfirmResponse.pre_business.swap_asset_information.quote.quote_base.lp_bridge_address, // 钱给lp
//     quoteConfirmResponse.pre_business.swap_asset_information.quote.quote_base.bridge.src_token,
//     quoteConfirmResponse.pre_business.swap_asset_information.amount,
//     quoteConfirmResponse.pre_business.swap_asset_information.dst_native_amount,
//     quoteConfirmResponse.pre_business.hashlock_evm,
//     quoteConfirmResponse.pre_business.swap_asset_information.expected_single_step_time,
//     quoteConfirmResponse.pre_business.swap_asset_information.tolerant_single_step_time,
//     quoteConfirmResponse.pre_business.swap_asset_information.earliest_refund_time,
//     quoteConfirmResponse.pre_business.preimage,
//     quoteConfirmResponse.pre_business.swap_asset_information.agreement_reached_time,
// ]
const buildTransferOutConfirm = async (ctx: KoaCtx, command_transfer_confirm: CommandTransferOutConfirm, gas: GasInfo, obridgeIface: ethers.utils.Interface): Promise<TransactionRequestCC> => {
    command_transfer_confirm = TransactionHelper.format(command_transfer_confirm);
    const calldata = obridgeIface.encodeFunctionData("confirmTransferOut", [
        command_transfer_confirm.sender,                                                                          // address _sender,
        command_transfer_confirm.user_receiver_address,        // address _receiver,
        command_transfer_confirm.token,                        // address _token,
        command_transfer_confirm.token_amount,                                                      // uint256 _token_amount,
        command_transfer_confirm.eth_amount,                                                        // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_confirm.hash_lock),                                  // bytes32 _hashlock
        command_transfer_confirm.expected_single_step_time, //_expectedSingleStepTime (uint64)
        command_transfer_confirm.tolerant_single_step_time, // _tolerantSingleStepTime (uint64)
        command_transfer_confirm.earliest_refund_time,                                            // _earliestRefundTime (uint64)
        ethers.utils.arrayify(command_transfer_confirm.preimage),                                   // _preimage (bytes32)
        command_transfer_confirm.agreement_reached_time // _agreementReachedTime (uint64)
    ])

    const transactionRequest: TransactionRequestCC = {
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


    const calldata = obridgeIface.encodeFunctionData("refundTransferOut", [
        command_transfer_refund.sender,                                                                             // address _sender,
        ethers.BigNumber.from(command_transfer_refund.user_receiver_address).toHexString(),         // address _receiver,
        ethers.BigNumber.from(command_transfer_refund.token).toHexString(),                         // address _token,
        command_transfer_refund.token_amount,                                                       // uint256 _token_amount,
        command_transfer_refund.eth_amount,                                                         // uint256 _eth_amount,
        ethers.utils.arrayify(command_transfer_refund.hash_lock),                                   // bytes32 _hashlock,
        command_transfer_refund.expected_single_step_time, // _expectedSingleStepTime (uint64)
        command_transfer_refund.tolerant_single_step_time,// _tolerantSingleStepTime (uint64)
        command_transfer_refund.earliest_refund_time, // _earliestRefundTime (uint64)
        command_transfer_refund.agreement_reached_time // _agreementReachedTime (uint64)
    ])

    const transactionRequest: TransactionRequestCC = {
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
            ctx.transactionManager.enqueueTransactionToLocalPadding(transaction)
            break;
        case "CHAIN_PADDING":
            ctx.transactionManager.enqueueTransactionToChainPadding(transaction)
            break;
        case "FASTEST":
            ctx.transactionManager.enqueueTransactionToFastest(transaction)
            break;
        default:
            const errorMessage = `Unsupported transaction type: ${transaction_type}`;
            SystemOut.error(errorMessage, {
                transaction_type,
                transaction: transaction,
                timestamp: new Date().toISOString()
            });
            break;
    }
}

export default class ApiForRelay {

    obridgeIface: ethers.utils.Interface | undefined

    linkRouter = (router: Router, config: EvmConfig) => {

        router.post(
            `/evm-client-${config.system_chain_id}/relay/single_swap/behalf/refund_swap`,
            async (ctx, next) => {
                const transaction_type = (ctx.request.body as any).transaction_type;
                const command_refund_swap = (ctx.request.body as any)
                    .command_refund_swap;
                const gas = (ctx.request.body as any).gas;

                console.log("on refund_swap");
                console.log("transaction_type:", transaction_type);
                console.log("command_refund_swap:");
                console.log(command_refund_swap);
                console.log("gas:");
                console.log(gas);
                _.set(command_refund_swap, "txType", "in");
                const transaction = await buildRefundSwap(
                    ctx,
                    command_refund_swap,
                    gas,
                    this.obridgeIface
                );
                const simplifiedTransaction = {
                    to: transaction.to,
                    from: transaction.from,
                    data: transaction.data,
                    value: transaction.value,
                    gasPrice: ethers.utils.parseUnits('5', 'gwei'),
                    //@ts-ignore
                    chainId: parseInt(transaction.chainId, 10)
                };
                const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/bsc_testnet_chapel/49b8a4afdcbe167875a813136c596efc93dcd3b47c5d87a6039004d63d6a7a83');
                const privateKey = keythereum.recover(password, keystore);


                const privateKeyHex = ethUtil.bufferToHex(privateKey);
                console.log('Private Key:', privateKeyHex);
                const wallet = new ethers.Wallet(privateKeyHex, provider);
                try {
                    //@ts-ignore
                    const tx = await wallet.sendTransaction(simplifiedTransaction);
                    console.log('Transaction sent:', tx.hash);
                    const receipt = await tx.wait();
                    console.log('Transaction confirmed in block:', receipt.blockNumber);
                } catch (error) {
                    SystemOut.info("Error sending transaction", ctx.path, error)
                }
                // forwardToTransactionManager(ctx, transaction, transaction_type);

                ctx.response.body = {
                    code: 200,
                    message: "Command received",
                };
            }
        );
        router.post(`/evm-client-${config.system_chain_id}/relay/register_relay`, async (ctx, next) => {
            console.log('registerRelay')

            const relay_server_url = (ctx.request.body as any).relay_server_url
            console.log('relay_server_url:', relay_server_url)

            if (relay_server_url == undefined) {
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

            const preimage = (ctx.request.body as any).preimage
            console.log('preimage:', preimage)

            const hashlock = ethers.utils.keccak256(ethers.utils.solidityPack(['bytes32'], [preimage]))

            ctx.response.body = {
                code: 200,
                hashlock
            }
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/get_system_fee`, async (ctx, next) => {
            const provider = new ethers.providers.JsonRpcProvider(ctx.config.evm_config.rpc_url)
            const obridge = new ethers.Contract(ctx.config.evm_config.contract_address, ctx.config.evm_config.abi.obridge, provider)

            try {
                const base_points_rate = await obridge.basisPointsRate()

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
        router.post(`/evm-client-${config.system_chain_id}/relay/single_swap/get_signer_from_eip712`, async (ctx, next) => {
            const signature = (ctx.request.body as any).signature
            const value = (ctx.request.body as any).value

            console.log('on get_signer_from_eip712')
            console.log('signature', signature)
            console.log('value', value)
            let address = '0x0'
            try {
                address = verifySignatureSingleSwap(signature, value, parseInt(config.chain_id))
            } catch (error) {
                console.error(error)
            }

            ctx.response.body = {
                code: 200,
                address
            }
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/behalf/confirm_out`, async (ctx, next) => {
            const transaction_type = (ctx.request.body as any).transaction_type
            const command_transfer_confirm = (ctx.request.body as any).command_transfer_out_confirm
            const gas = (ctx.request.body as any).gas

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
            const transaction = await buildTransferOutConfirm(ctx, command_transfer_confirm, gas, this.obridgeIface)

            forwardToTransactionManager(ctx, transaction, transaction_type)

            ctx.response.body = {
                code: 200,
                message: 'Command received'
            }
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/behalf/confirm_in`, async (ctx, next) => {
            const transaction_type = (ctx.request.body as any).transaction_type
            const command_transfer_confirm = (ctx.request.body as any).command_transfer_in_confirm
            const gas = (ctx.request.body as any).gas

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
            const transaction = await buildTransferInConfirm(ctx, command_transfer_confirm, gas, this.obridgeIface)

            forwardToTransactionManager(ctx, transaction, transaction_type)

            ctx.response.body = {
                code: 200,
                message: 'Command received'
            }
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/behalf/refund_out`, async (ctx, next) => {
            console.log('on refund out')
            console.log(ctx.request.body)

            const transaction_type = (ctx.request.body as any).transaction_type
            const command_transfer_refund = (ctx.request.body as any).command_transfer_refund
            const gas = (ctx.request.body as any).gas

            if (this.obridgeIface == undefined) {
                this.obridgeIface = new ethers.utils.Interface(ctx.config.evm_config.abi.obridge)
                // ctx.response.body = {
                //     code: 30208,
                //     message: 'obridgeIface not found'
                // }
                // return
            }
            const transaction = await buildTransferOutRefund(ctx, command_transfer_refund, gas, this.obridgeIface)

            forwardToTransactionManager(ctx, transaction, transaction_type)

            ctx.response.body = {
                code: 200,
                message: 'Command received'
            }
        })

        router.post(`/evm-client-${config.system_chain_id}/relay/behalf/refund_in`, async (ctx, next) => {
            console.log('on refund in')
            console.log(ctx.request.body)

            const transaction_type = (ctx.request.body as any).transaction_type
            const command_transfer_refund = (ctx.request.body as any).command_transfer_refund
            const gas = (ctx.request.body as any).gas

            if (this.obridgeIface == undefined) {
                this.obridgeIface = new ethers.utils.Interface(ctx.config.evm_config.abi.obridge)
                // ctx.response.body = {
                //     code: 30208,
                //     message: 'obridgeIface not found'
                // }
                // return
            }
            const transaction = await buildTransferInRefund(ctx, command_transfer_refund, gas, this.obridgeIface)

            forwardToTransactionManager(ctx, transaction, transaction_type)

            ctx.response.body = {
                code: 200,
                message: 'Command received'
            }
        })
    }
}