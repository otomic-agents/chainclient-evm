import Koa from "koa";
import bodyParser from "koa-bodyparser";
import stringify from "json-stringify-safe";
const crypto = require("crypto");
import Router from "@koa/router";
import {
  CommandTransferConfirm,
  CommandTransferIn,
  CommandTransferRefund,
  EvmConfig,
  GasInfo,
  KoaCtx,
  TransactionRequestCC,
} from "../interface/interface";
import { ethers } from "ethers";
import {
  watchConfirmIn,
  watchConfirmOut,
  watchRefundIn,
  watchRefundOut,
  watchTransferIn,
  watchTransferOut,
} from "../serverUtils/WatcherFactory";

const buildTransferIn = async (
  ctx: KoaCtx,
  command_transfer_in: CommandTransferIn,
  gas: GasInfo,
  obridgeIface: ethers.utils.Interface
): Promise<TransactionRequestCC> => {
  let wallet_address = await ctx.wallet.getAddress(
    command_transfer_in.sender_wallet_name
  );
  let calldata = obridgeIface.encodeFunctionData("transferIn", [
    wallet_address, // address _sender,
    ethers.BigNumber.from(
      command_transfer_in.user_receiver_address
    ).toHexString(), // address _dstAddress,
    ethers.BigNumber.from(command_transfer_in.token).toHexString(), // address _token,
    command_transfer_in.token_amount, // uint256 _token_amount,
    command_transfer_in.eth_amount, // uint256 _eth_amount,
    ethers.utils.arrayify(command_transfer_in.hash_lock), // bytes32 _hashlock,
    command_transfer_in.step_time_lock, // uint64 _timelock,
    command_transfer_in.src_chain_id, // uint64 _srcChainId,
    ethers.utils.arrayify(command_transfer_in.src_transfer_id), // bytes32 _srcTransferId
    command_transfer_in.agreement_reached_time,
  ]);

  let transactionRequest: TransactionRequestCC = {
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
    error: undefined,
  };

  transactionRequest.rawData = command_transfer_in;

  return transactionRequest;
};

const buildTransferConfirm = async (
  ctx: KoaCtx,
  command_transfer_confirm: CommandTransferConfirm,
  gas: GasInfo,
  obridgeIface: ethers.utils.Interface
): Promise<TransactionRequestCC> => {
  let wallet_address = await ctx.wallet.getAddress(
    command_transfer_confirm.sender_wallet_name
  );
  let calldata = obridgeIface.encodeFunctionData("confirmTransferIn", [
    wallet_address, // address _sender,
    ethers.BigNumber.from(
      command_transfer_confirm.user_receiver_address
    ).toHexString(), // address _receiver,
    ethers.BigNumber.from(command_transfer_confirm.token).toHexString(), // address _token,
    command_transfer_confirm.token_amount, // uint256 _token_amount,
    command_transfer_confirm.eth_amount, // uint256 _eth_amount,
    ethers.utils.arrayify(command_transfer_confirm.hash_lock), // bytes32 _hashlock,
    command_transfer_confirm.step_time_lock, // uint64 _timelock,
    ethers.utils.arrayify(command_transfer_confirm.preimage), // bytes32 _preimage
    command_transfer_confirm.agreement_reached_time,
  ]);

  let transactionRequest: TransactionRequestCC = {
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

const buildTransferRefund = async (
  ctx: KoaCtx,
  command_transfer_refund: CommandTransferRefund,
  gas: GasInfo,
  obridgeIface: ethers.utils.Interface
): Promise<TransactionRequestCC> => {
  let wallet_address = await ctx.wallet.getAddress(
    command_transfer_refund.sender_wallet_name
  );
  let calldata = obridgeIface.encodeFunctionData("refundTransferIn", [
    wallet_address, // address _sender,
    ethers.BigNumber.from(
      command_transfer_refund.user_receiver_address
    ).toHexString(), // address _receiver,
    ethers.BigNumber.from(command_transfer_refund.token).toHexString(), // address _token,
    command_transfer_refund.token_amount, // uint256 _token_amount,
    command_transfer_refund.eth_amount, // uint256 _eth_amount,
    ethers.utils.arrayify(command_transfer_refund.hash_lock), // bytes32 _hashlock,
    command_transfer_refund.step_time_lock, // uint64 _timelock,
    command_transfer_refund.agreement_reached_time,
  ]);

  let transactionRequest: TransactionRequestCC = {
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
  console.group("on forwardToTransactionManager");
  console.log("transaction");
  console.log(transaction);
  console.log("transaction_type");
  console.log(transaction_type);
  console.groupEnd();

  switch (transaction_type) {
    case "LOCAL_PADDING":
      ctx.transactionManager.sendTransactionLocalPadding(transaction);
      break;
    case "CHAIN_PADDING":
      ctx.transactionManager.sendTransactionChainPadding(transaction);
      break;
    case "FASTEST":
      ctx.transactionManager.sendTransactionFastest(transaction);
      break;
    default:
      break;
  }
};

function getObjectHash(obj) {
  // 将对象序列化为一个确定的字符串表示
  function serializeObject(obj) {
    if (typeof obj !== "object" || obj === null) {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      return `[${obj.map(serializeObject).join(",")}]`;
    }

    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((key) => `${key}:${serializeObject(obj[key])}`)
      .join(",")}}`;
  }

  // 使用 MD5 哈希算法生成哈希值
  const serializedObj = serializeObject(obj);
  const hash = crypto.createHash("md5").update(serializedObj).digest("hex");
  return hash;
}

function cacheByFirstParamHashDecorator(): any {
  const cacheMap = new Map();

  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args) {
      const firstParam = args[0];
      const paramHash = getObjectHash(firstParam);

      if (cacheMap.has(paramHash)) {
        console.log("Using cached result for hash", paramHash);
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
  private registerLpnode(requestBody, monitor, config) {
    let lpnode_server_url = requestBody.lpnode_server_url;
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
        console.log("register_lpnode_support_duplication");
        ctx.response.body = {
          code: 200,
          message: "true",
        };
      }
    );
    router.post(
      `/evm-client-${config.system_chain_id}/lpnode/register_lpnode`,
      async (ctx, next) => {
        console.log("registerLPNode");

        if (this.obridgeIface == undefined) {
          this.obridgeIface = new ethers.utils.Interface(
            ctx.config.evm_config.abi.obridge
          );

          console.log("config:");
          console.log(ctx.config.evm_config);

          console.log("obridgeIface:");
          console.log(this.obridgeIface);
        }

        let lpnode_server_url = (ctx.request.body as any).lpnode_server_url;
        console.log("lpnode_server_url:", lpnode_server_url);
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
        let transaction_type = (ctx.request.body as any).transaction_type;
        let command_transfer_in = (ctx.request.body as any).command_transfer_in;
        let gas = (ctx.request.body as any).gas;

        console.log("on transfer in");
        console.log("transaction_type:", transaction_type);
        console.log("command_transfer_in:");
        console.log(command_transfer_in);
        console.log("gas:");
        console.log(gas);

        if (this.obridgeIface == undefined) {
          ctx.response.body = {
            code: 30208,
            message: "obridgeIface not found",
          };
          return;
        }
        let transaction = await buildTransferIn(
          ctx,
          command_transfer_in,
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
      `/evm-client-${config.system_chain_id}/lpnode/refund`,
      async (ctx, next) => {
        console.log("on refund");
        console.log(ctx.request.body);

        let transaction_type = (ctx.request.body as any).transaction_type;
        let command_transfer_refund = (ctx.request.body as any)
          .command_transfer_refund;
        let gas = (ctx.request.body as any).gas;

        if (this.obridgeIface == undefined) {
          ctx.response.body = {
            code: 30208,
            message: "obridgeIface not found",
          };
          return;
        }
        let transaction = await buildTransferRefund(
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
      `/evm-client-${config.system_chain_id}/lpnode/confirm`,
      async (ctx, next) => {
        let transaction_type = (ctx.request.body as any).transaction_type;
        let command_transfer_confirm = (ctx.request.body as any)
          .command_transfer_in_confirm;
        let gas = (ctx.request.body as any).gas;

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
        let transaction = await buildTransferConfirm(
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

        console.log("on sign_message_712");
        console.log("signData", signData);
        console.log("walletName", walletName);

        const signed = await ctx.wallet.signMessage712(signData, walletName);

        console.log("signed", signed);
        ctx.response.body = {
          code: 200,
          signed: signed,
        };
      }
    );
  };
}
