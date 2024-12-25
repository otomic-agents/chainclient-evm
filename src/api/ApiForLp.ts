const crypto = require("crypto");
import Router from "@koa/router";
const ethUtil = require('ethereumjs-util');
const keythereum = require('keythereum');
const fs = require('fs');
const keystore = JSON.parse(fs.readFileSync('/home/coder/keystore/lp_9006_keystore/keystore', 'utf8'));

const password = '1Q2Q3Q4Q8Q';
import {
  CommandTransferConfirm,
  CommandTransferIn,
  CommandTransferRefund,
  EvmConfig,
  GasInfo,
  KoaCtx,
  TransactionRequestCC,
  CommandConfirmSwap
} from "../interface/interface";
import { BigNumber, ethers } from "ethers";
import {
  watchConfirmIn,
  watchConfirmOut,
  watchRefundIn,
  watchRefundOut,
  watchTransferIn,
  watchTransferOut,
} from "../serverUtils/WatcherFactory";
import { SystemOut } from "../utils/systemOut";
import Monitor from "../monitor/Monitor";
import { SystemBus } from "../bus/bus";
import _ from "lodash";
const AddressZero = "0x0000000000000000000000000000000000000000";
const buildTransferIn = async (
  ctx: KoaCtx,
  command_transfer_in: CommandTransferIn,
  gas: GasInfo,
  obridgeIface: ethers.utils.Interface
): Promise<TransactionRequestCC> => {
  const wallet_address = await ctx.wallet.getAddress(
    command_transfer_in.sender_wallet_name
  );
  if (!wallet_address) {
    throw new Error("wallet not found");
  }
  let token = ethers.BigNumber.from(command_transfer_in.token).toHexString(); // address
  console.log(
    "ethers.BigNumber.from(command_transfer_in.token).toHexString()",
    ethers.BigNumber.from(command_transfer_in.token).toHexString()
  );
  let targetIsNativeToken = false;
  if (
    ethers.BigNumber.from(command_transfer_in.token).toHexString() == "0x00"
  ) {
    token = AddressZero;
    targetIsNativeToken = true;
  }

  const calldata = obridgeIface.encodeFunctionData("transferIn", [
    wallet_address, // address _sender,
    ethers.BigNumber.from(
      command_transfer_in.user_receiver_address
    ).toHexString(), // address _dstAddress,
    token, // _token (address)
    command_transfer_in.token_amount, // _token_amount (uint256),
    command_transfer_in.eth_amount, // _eth_amount (uint256),
    ethers.utils.arrayify(command_transfer_in.hash_lock), // bytes32 _hashlock,
    command_transfer_in.expected_single_step_time, // _expectedSingleStepTime (uint64),
    command_transfer_in.tolerant_single_step_time,   // _tolerantSingleStepTime(uint64)
    command_transfer_in.earliest_refund_time, // _earliestRefundTime(uint64)
    command_transfer_in.src_chain_id, // uint64 _srcChainId,
    ethers.utils.arrayify(command_transfer_in.src_transfer_id), // bytes32 _srcTransferId
    command_transfer_in.agreement_reached_time,
  ]);

  const transactionRequest: TransactionRequestCC = {
    to: ctx.config.evm_config.contract_address,
    from: wallet_address,
    data: calldata,
    value: command_transfer_in.eth_amount + "",
    gasPrice: gas.gas_price,
    chainId: ctx.config.evm_config.chain_id,

    rawData: undefined,
    transactionHash: undefined,
    gasLimit: undefined,
    nonce: undefined,
    transactionReceipt: undefined,
    sended: undefined,
    error: undefined
  };
  if (targetIsNativeToken) {
    transactionRequest.value = command_transfer_in.token_amount;
  }
  transactionRequest.rawData = command_transfer_in;
  return transactionRequest;
};

const buildTransferConfirm = async (
  ctx: KoaCtx,
  command_transfer_confirm: CommandTransferConfirm,
  gas: GasInfo,
  obridgeIface: ethers.utils.Interface
): Promise<TransactionRequestCC> => {
  const wallet_address = await ctx.wallet.getAddress(
    command_transfer_confirm.sender_wallet_name
  );
  let token = ethers.BigNumber.from(
    command_transfer_confirm.token
  ).toHexString();
  let targetIsNativeToken = false;
  if (
    ethers.BigNumber.from(command_transfer_confirm.token).toHexString() ==
    "0x00"
  ) {
    token = AddressZero;
    targetIsNativeToken = true;
  }
  const calldata = obridgeIface.encodeFunctionData("confirmTransferIn", [
    wallet_address, // _sender (address)
    ethers.BigNumber.from(
      command_transfer_confirm.user_receiver_address
    ).toHexString(), // _receiver (address)
    token, // _token (address),
    command_transfer_confirm.token_amount, // uint256 _token_amount,
    command_transfer_confirm.eth_amount, // uint256 _eth_amount,
    ethers.utils.arrayify(command_transfer_confirm.hash_lock), // bytes32 _hashlock,
    command_transfer_confirm.expected_single_step_time, // _expectedSingleStepTime (uint64)
    command_transfer_confirm.tolerant_single_step_time, // _tolerantSingleStepTime (uint64)
    command_transfer_confirm.earliest_refund_time, // _earliestRefundTime (uint64)
    ethers.utils.arrayify(command_transfer_confirm.preimage), // bytes32 _preimage
    command_transfer_confirm.agreement_reached_time, // _agreementReachedTime (uint64)
  ]);

  const transactionRequest: TransactionRequestCC = {
    to: ctx.config.evm_config.contract_address,
    from: wallet_address,
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
  transactionRequest.rawData = command_transfer_confirm
  return transactionRequest;
};
const abi = [{ "inputs": [{ "internalType": "string", "name": "op", "type": "string" }, { "internalType": "uint64", "name": "expiredAt", "type": "uint64" }], "name": "ExpiredOp", "type": "error" }, { "inputs": [], "name": "FailedToSendEther", "type": "error" }, { "inputs": [], "name": "InvalidAmount", "type": "error" }, { "inputs": [], "name": "InvalidSender", "type": "error" }, { "inputs": [], "name": "InvalidStatus", "type": "error" }, { "inputs": [{ "internalType": "string", "name": "op", "type": "string" }, { "internalType": "uint64", "name": "lockedUntil", "type": "uint64" }], "name": "NotUnlock", "type": "error" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "bytes32", "name": "transferId", "type": "bytes32" }, { "indexed": false, "internalType": "address", "name": "sender", "type": "address" }, { "indexed": false, "internalType": "address", "name": "receiver", "type": "address" }, { "indexed": false, "internalType": "address", "name": "srcToken", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "srcAmount", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "dstToken", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "dstAmount", "type": "uint256" }, { "indexed": false, "internalType": "uint64", "name": "stepTime", "type": "uint64" }, { "indexed": false, "internalType": "uint64", "name": "agreementReachedTime", "type": "uint64" }, { "indexed": false, "internalType": "bytes32", "name": "bidId", "type": "bytes32" }, { "indexed": false, "internalType": "string", "name": "requestor", "type": "string" }, { "indexed": false, "internalType": "string", "name": "lpId", "type": "string" }, { "indexed": false, "internalType": "string", "name": "userSign", "type": "string" }, { "indexed": false, "internalType": "string", "name": "lpSign", "type": "string" }], "name": "LogInitSwap", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "bytes32", "name": "transferId", "type": "bytes32" }], "name": "LogSwapConfirmed", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "bytes32", "name": "transferId", "type": "bytes32" }], "name": "LogSwapRefunded", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }], "name": "OwnershipTransferred", "type": "event" }, { "inputs": [], "name": "approveOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "basisPointsRate", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_sender", "type": "address" }, { "internalType": "address", "name": "_receiver", "type": "address" }, { "internalType": "address", "name": "_srcToken", "type": "address" }, { "internalType": "uint256", "name": "_srcAmount", "type": "uint256" }, { "internalType": "address", "name": "_dstToken", "type": "address" }, { "internalType": "uint256", "name": "_dstAmount", "type": "uint256" }, { "internalType": "uint64", "name": "_stepTime", "type": "uint64" }, { "internalType": "uint64", "name": "_agreementReachedTime", "type": "uint64" }], "name": "confirmSwap", "outputs": [], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_sender", "type": "address" }, { "internalType": "address", "name": "_receiver", "type": "address" }, { "internalType": "address", "name": "_srcToken", "type": "address" }, { "internalType": "uint256", "name": "_srcAmount", "type": "uint256" }, { "internalType": "address", "name": "_dstToken", "type": "address" }, { "internalType": "uint256", "name": "_dstAmount", "type": "uint256" }, { "internalType": "uint64", "name": "_stepTime", "type": "uint64" }, { "internalType": "uint64", "name": "_agreementReachedTime", "type": "uint64" }, { "internalType": "bytes32", "name": "_bidId", "type": "bytes32" }, { "internalType": "string", "name": "_requestor", "type": "string" }, { "internalType": "string", "name": "_lpId", "type": "string" }, { "internalType": "string", "name": "_userSign", "type": "string" }, { "internalType": "string", "name": "_lpSign", "type": "string" }], "name": "initSwap", "outputs": [], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "maximumFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "nextOwner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_sender", "type": "address" }, { "internalType": "address", "name": "_receiver", "type": "address" }, { "internalType": "address", "name": "_srcToken", "type": "address" }, { "internalType": "uint256", "name": "_srcAmount", "type": "uint256" }, { "internalType": "address", "name": "_dstToken", "type": "address" }, { "internalType": "uint256", "name": "_dstAmount", "type": "uint256" }, { "internalType": "uint64", "name": "_stepTime", "type": "uint64" }, { "internalType": "uint64", "name": "_agreementReachedTime", "type": "uint64" }], "name": "refundSwap", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "rate", "type": "uint256" }], "name": "setBasisPointsRate", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "fee", "type": "uint256" }], "name": "setMaximumFee", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "toll", "type": "address" }], "name": "setTollAddress", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "name": "swapStatus", "outputs": [{ "internalType": "enum OtmoicSwap.TransferStatus", "name": "transferStatus", "type": "uint8" }, { "internalType": "uint256", "name": "srcTokenFee", "type": "uint256" }, { "internalType": "uint256", "name": "dstTokenFee", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "tollAddress", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "stateMutability": "payable", "type": "receive" }];

const buildConfirmSwap = async (
  ctx: KoaCtx,
  command_confirm_swap: CommandConfirmSwap,
  gas: GasInfo,
  obridgeIface: ethers.utils.Interface
): Promise<TransactionRequestCC> => {
  const wallet_address = await ctx.wallet.getAddress(
    command_confirm_swap.sender_wallet_name
  );
  const iface = new ethers.utils.Interface(abi);


  const params = [
    command_confirm_swap.sender,
    command_confirm_swap.user_receiver_address,
    command_confirm_swap.token,
    command_confirm_swap.token_amount,
    command_confirm_swap.dst_token,
    command_confirm_swap.dst_amount,
    command_confirm_swap.expected_single_step_time,
    command_confirm_swap.agreement_reached_time
  ];
  const calldata = iface.encodeFunctionData("confirmSwap", params)

  console.log("Encoded parameters:", params);



  console.log(params)

  console.log("calldata")
  const transactionRequest: TransactionRequestCC = {
    to: "0x22dD71312bC00823634676EEe5B289936E0B54c1",
    from: wallet_address,
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
  transactionRequest.rawData = command_confirm_swap
  // @ts-ignore
  transactionRequest.rawData.token = command_confirm_swap.dst_token;
  return transactionRequest;

};

const buildTransferRefund = async (
  ctx: KoaCtx,
  command_transfer_refund: CommandTransferRefund,
  gas: GasInfo,
  obridgeIface: ethers.utils.Interface
): Promise<TransactionRequestCC> => {
  const wallet_address = await ctx.wallet.getAddress(
    command_transfer_refund.sender_wallet_name
  );
  let token = ethers.BigNumber.from(command_transfer_refund.token).toHexString(); // address
  let targetIsNativeToken = false;
  if (
    ethers.BigNumber.from(command_transfer_refund.token).toHexString() == "0x00"
  ) {
    token = AddressZero;
    targetIsNativeToken = true;
  }
  const calldata = obridgeIface.encodeFunctionData("refundTransferIn", [
    wallet_address, // address _sender,
    ethers.BigNumber.from(
      command_transfer_refund.user_receiver_address
    ).toHexString(), // address _receiver,
    token, // address _token,
    command_transfer_refund.token_amount, // uint256 _token_amount,
    command_transfer_refund.eth_amount, // uint256 _eth_amount,
    ethers.utils.arrayify(command_transfer_refund.hash_lock), // bytes32 _hashlock,
    command_transfer_refund.expected_single_step_time, // _expectedSingleStepTime (uint64)
    command_transfer_refund.tolerant_single_step_time, // _tolerantSingleStepTime (uint64)
    command_transfer_refund.earliest_refund_time, // _earliestRefundTime (uint64)
    command_transfer_refund.agreement_reached_time, // _agreementReachedTime (uint64)
  ]);

  const transactionRequest: TransactionRequestCC = {
    to: ctx.config.evm_config.contract_address,
    from: wallet_address,
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

  return transactionRequest;
};

const forwardToTransactionManager = (
  ctx: KoaCtx,
  transaction: TransactionRequestCC,
  transaction_type: string
) => {
  console.log("transaction");
  console.log(transaction);
  console.log("transaction_type");
  console.log(transaction_type);

  switch (transaction_type) {
    case "LOCAL_PADDING":
      ctx.transactionManager.enqueueTransactionToLocalPadding(transaction);
      break;
    case "CHAIN_PADDING":
      ctx.transactionManager.enqueueTransactionToChainPadding(transaction);
      break;
    case "FASTEST":
      ctx.transactionManager.enqueueTransactionToFastest(transaction);
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
};

function getObjectHash(obj: any) {
  function serializeObject(obj: any): any {
    if (typeof obj !== "object" || obj === null) {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      return `[${obj.map(serializeObject).join(",")}]`;
    }

    const keys = Object.keys(obj).sort();
    return `{${keys.map((key) => `${key}:${serializeObject(obj[key])}`).join(",")}}`;
  }

  // 使用 MD5 哈希算法生成哈希值
  const serializedObj = serializeObject(obj);
  const hash = crypto.createHash("md5").update(serializedObj).digest("hex");
  return hash;
}

function cacheByFirstParamHashDecorator(): any {
  const cacheMap = new Map();

  return function (target: any, propertyKey: any, descriptor: any) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const firstParam = args[0];
      const paramHash = getObjectHash(firstParam);

      if (cacheMap.has(paramHash)) {
        SystemOut.debug("Using cached result for hash", paramHash);
        return cacheMap.get(paramHash);
      }

      const result = originalMethod.apply(this, args);
      cacheMap.set(paramHash, result);
      return result;
    };

    return descriptor;
  };
}

export default class ApiForLp {
  obridgeIface: ethers.utils.Interface | undefined;
  @cacheByFirstParamHashDecorator()
  private registerLpnode(requestBody: any, monitor: Monitor, config: any) {
    const lpnode_server_url = requestBody.lpnode_server_url;
    SystemOut.debug(lpnode_server_url);
    if (lpnode_server_url == undefined) {
      return {
        code: 30207,
        message: "lpnode_server_url not found",
      };
    } else {
      watchTransferOut(
        monitor,
        lpnode_server_url.on_transfer_out,
        config,
        false,
        undefined
      );
      watchTransferIn(
        monitor,
        lpnode_server_url.on_transfer_in,
        config,
        false,
        undefined
      );
      // watchConfirmOut(ctx.monitor, lpnode_server_url.on_confirm_out, config, false, undefined)
      // watchConfirmIn(ctx.monitor, lpnode_server_url.on_confirm_in, config, false, undefined)
      // watchRefundOut(ctx.monitor, lpnode_server_url.on_refunded_out, config, false, undefined)
      // watchRefundIn(ctx.monitor, lpnode_server_url.on_refunded_in, config, false, undefined)
      watchConfirmOut(
        monitor,
        lpnode_server_url.on_confirm,
        config,
        false,
        undefined
      );
      watchConfirmIn(
        monitor,
        lpnode_server_url.on_confirm,
        config,
        false,
        undefined
      );
      watchRefundOut(
        monitor,
        lpnode_server_url.on_refunded,
        config,
        false,
        undefined
      );
      watchRefundIn(
        monitor,
        lpnode_server_url.on_refunded,
        config,
        false,
        undefined
      );
      return {
        code: 200,
        message: "register succeed",
      };
    }
  }
  linkRouter = (router: Router, config: EvmConfig) => {
    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/register_lpnode_support_duplication`,
      async (ctx, next) => {
        ctx.response.body = {
          code: 200,
          message: "true",
        };
      }
    );
    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/register_lpnode`,
      async (ctx, next) => {
        if (this.obridgeIface == undefined) {
          this.obridgeIface = new ethers.utils.Interface(
            ctx.config.evm_config.abi.obridge
          );

          SystemOut.info("config:");
          SystemOut.info(JSON.stringify(ctx.config.evm_config));

          // systemOutput.info('obridgeIface:')
          // systemOutput.info(JSON.stringify(this.obridgeIface))
        }
        ctx.response.body = this.registerLpnode(
          ctx.request.body,
          ctx.monitor,
          config
        );
      }
    );

    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/transfer_in`,
      async (ctx, next) => {
        SystemBus.sendAction({ action: "new_transaction_request", payload: _.clone(ctx.request.body) })
        const transaction_type = (ctx.request.body as any).transaction_type;
        const command_transfer_in = (ctx.request.body as any)
          .command_transfer_in;
        const gas = (ctx.request.body as any).gas;

        console.log("on transfer in");
        console.log("transaction_type:", transaction_type);
        console.log("command_transfer_in:");
        console.log(command_transfer_in);
        console.log("gas:", gas);

        if (this.obridgeIface == undefined) {
          ctx.response.body = {
            code: 30208,
            message: "obridgeIface not found",
          };
          return;
        }
        _.set(command_transfer_in, "txType", "in");
        try {
          const transaction = await buildTransferIn(
            ctx,
            command_transfer_in,
            gas,
            this.obridgeIface
          );

          forwardToTransactionManager(ctx, transaction, transaction_type);
        } catch (e) {
          ctx.response.body = {
            code: 30209,
            message: "buildTransferIn error",
          };
          SystemOut.error(e);
        }

        ctx.response.body = {
          code: 200,
          message: "Command received",
        };
      }
    );

    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/refund`,
      async (ctx, next) => {
        console.log("on refund");
        console.log(ctx.request.body);

        const transaction_type = (ctx.request.body as any).transaction_type;
        const command_transfer_refund = (ctx.request.body as any)
          .command_transfer_refund;
        const gas = (ctx.request.body as any).gas;

        if (this.obridgeIface == undefined) {
          ctx.response.body = {
            code: 30208,
            message: "obridgeIface not found",
          };
          return;
        }
        const transaction = await buildTransferRefund(
          ctx,
          command_transfer_refund,
          gas,
          this.obridgeIface
        );

        forwardToTransactionManager(ctx, transaction, transaction_type);

        ctx.response.body = {
          code: 200,
          message: "Command received",
        };
      }
    );

    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/single_swap/confirm_swap`,
      async (ctx, next) => {
        const transaction_type = (ctx.request.body as any).transaction_type;
        const command_confirm_swap = (ctx.request.body as any)
          .command_confirm_swap;
        const gas = (ctx.request.body as any).gas;

        console.log("on confirm in");
        console.log("transaction_type:", transaction_type);
        console.log("command_confirm_swap:");
        console.log(command_confirm_swap);
        console.log("gas:");
        console.log(gas);
        _.set(command_confirm_swap, "txType", "in");
        if (this.obridgeIface == undefined) {
          ctx.response.body = {
            code: 30208,
            message: "obridgeIface not found",
          };
          return;
        }
        const transaction = await buildConfirmSwap(
          ctx,
          command_confirm_swap,
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
        // console.log('Private Key:', privateKeyHex);
        const wallet = new ethers.Wallet(privateKeyHex, provider);
        try {
          //@ts-ignore
          const tx = await wallet.sendTransaction(simplifiedTransaction);
          console.log('Transaction sent:', tx.hash);
          const receipt = await tx.wait();
          console.log('Transaction confirmed in block:', receipt.blockNumber);
        } catch (error) {
          console.error('Error sending transaction:', error);
        }
        // forwardToTransactionManager(ctx, transaction, transaction_type);

        ctx.response.body = {
          code: 200,
          message: "Command received",
        };
      }
    );

    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/confirm`,
      async (ctx, next) => {
        const transaction_type = (ctx.request.body as any).transaction_type;
        const command_transfer_confirm = (ctx.request.body as any)
          .command_transfer_in_confirm;
        const gas = (ctx.request.body as any).gas;

        console.log("on confirm in");
        console.log("transaction_type:", transaction_type);
        console.log("command_transfer_confirm:");
        console.log(command_transfer_confirm);
        console.log("gas:");
        console.log(gas);

        if (this.obridgeIface == undefined) {
          ctx.response.body = {
            code: 30208,
            message: "obridgeIface not found",
          };
          return;
        }
        const transaction = await buildTransferConfirm(
          ctx,
          command_transfer_confirm,
          gas,
          this.obridgeIface
        );

        forwardToTransactionManager(ctx, transaction, transaction_type);

        ctx.response.body = {
          code: 200,
          message: "Command received",
        };
      }
    );

    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/get_wallets`,
      async (ctx, next) => {
        let code = 500;
        let wallet_info;
        try {
          wallet_info = await ctx.wallet.getWalletInfo();
          code = 200;
        } catch (e) {
          console.error(e);
        } finally {
          ctx.response.body = {
            code: code,
            data: wallet_info,
          };
        }
      }
    );

    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/sign_message_712`,
      async (ctx, next) => {
        const signData = (ctx.request.body as any).sign_data;
        const walletName = (ctx.request.body as any).wallet_name;
        SystemOut.info("on sign_message_712", walletName, signData);
        const signed = await ctx.wallet.signMessage712(signData, walletName);

        console.log("signed", signed);
        ctx.response.body = {
          code: 200,
          signed: signed,
        };
      }
    );
    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/single_chain/sign_message_712`,
      async (ctx, next) => {
        const signData = (ctx.request.body as any).sign_data;
        const walletName = (ctx.request.body as any).wallet_name;
        SystemOut.info("on sign_message_712", walletName, signData);
        const signed = await ctx.wallet.signSingleChainMessage712(signData, walletName);

        console.log("signed", signed);
        ctx.response.body = {
          code: 200,
          signed: signed,
        };
      }
    );
  };
}
