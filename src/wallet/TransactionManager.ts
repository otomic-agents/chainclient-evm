import { BigNumber, BigNumberish, BytesLike, ethers } from "ethers";
import to from 'await-to-js';
import needle from "needle";
import bcrypt from "bcrypt";
import Wallet from "./Wallet";
const path = require("path");
const fs = require("fs");
import Config from "../config/Config";
import {
  EvmConfig,
  EvmRpcClient,
  TransactionRequestCC,
} from "../interface/interface";
import { Redis } from "ioredis";
import { AccessListish } from "ethers/lib/utils";
import BN from "bignumber.js";
import { SystemOut } from "../utils/systemOut";
import * as _ from "lodash";
import { throttledLog } from "../utils/comm";
const { dev, vault } = Config;
import * as async from "async";
import * as asyncLib from "async"
import { SystemBus } from "../bus/bus";
import axios from "axios";
const LOOP_STATUS_LOG = new throttledLog();
let CACHE_KEY_LOCAL_PADDING_LIST = "CACHE_KEY_LOCAL_PADDING_LIST";
let CACHE_KEY_LOCAL_SUCCEED_LIST = "CACHE_KEY_LOCAL_SUCCEED_LIST";
let CACHE_KEY_LOCAL_FAILED_LIST = "CACHE_KEY_LOCAL_FAILED_LIST";
const MAX_GET_TRANSACTION_RECEIPT_NUMBER = 35;
const MAX_MESSAGE = 10;
let baseNetAppPath: string | undefined;
let edge: any = null;
if (_.get(process, "env.USE_DOTNET", "false") === "true") {
  process.env.EDGE_USE_CORECLR = "1";
  baseNetAppPath = path.join(
    __dirname,
    "../../dotnet/StartUp/bin/Debug/net8.0"
  );
  process.env.EDGE_APP_ROOT = baseNetAppPath;
  edge = require("edge-js");
}

const getMaxGasPrice = (evmConfig: EvmConfig): string => {
  switch (evmConfig.system_chain_id) {
    case "9006": //BSC
      return "8000000000"; // 8 gwei
    case "9000": //AVAX
      // return 26000000010;
      return "-1";
    case "60":
      return "-1";
    case "966":
      return "-1";
    case "614":
      return "1000000000"; // 1 gwei
    default:
      return "-1";
  }
};
const getGasPrice = async (
  flag: string,
  evmConfig: EvmConfig
): Promise<number> => {
  switch (evmConfig.system_chain_id) {
    case "9006": //BSC
      if (evmConfig.chain_id === "97") return 5000000001;
      else return 5000000010;
      return -1;
    case "9000": //AVAX
      // return 26000000010;
      return -1;
    case "60":
      return -1;
    case "966":
      return -1;
    default:
      return -1;
  }
};

export type TransactionRequest = {
  to?: string;
  from?: string;
  nonce?: BigNumberish;

  gasLimit?: BigNumberish;
  gasPrice?: BigNumberish;

  data?: BytesLike;
  value?: BigNumberish;
  chainId?: number;

  type?: number;
  accessList?: AccessListish;

  maxPriorityFeePerGas?: BigNumberish;
  maxFeePerGas?: BigNumberish;

  customData?: Record<string, any>;
  ccipReadEnabled?: boolean;
};
class SendTransactionError extends Error {
  public code: number;
  constructor(code: number, message: string) {
    super(message);
  }
}
class TransactionCheckLoop {
  wallet: Wallet;
  paddingListHolder: TransactionManager;
  evmRpcClient: EvmRpcClient;
  evmConfig: EvmConfig;
  failNum: number;
  getTransactionReceiptFailNum: number;
  errorMessage: string[] = [];

  constructor(
    wallet: Wallet,
    paddingListHolder: TransactionManager,
    evmRpcClient: EvmRpcClient,
    evmConfig: EvmConfig
  ) {
    this.wallet = wallet;
    this.paddingListHolder = paddingListHolder;
    this.evmRpcClient = evmRpcClient;
    this.evmConfig = evmConfig;
    this.failNum = 0;
    this.getTransactionReceiptFailNum = 0;
    this.statusReport();
    this.check();
  }
  private pushErrorMessage(message: string) {
    // Check if the array length is already at its limit
    if (this.errorMessage.length >= MAX_MESSAGE) {
      // Remove the oldest message (first element) before adding the new one
      this.errorMessage.shift();
    }
    this.errorMessage.push(message);
  }
  private statusReport() {
    if (this.errorMessage.length > 0) {
      SystemOut.warn("transaction execute faild info:");
      console.table(this.errorMessage);
    }
    setTimeout(() => {
      this.statusReport();
    }, 1000 * 60);
  }
  vaultSign = (txData: any, evmConfig: EvmConfig, secert_id: string) =>
    new Promise(async (result, reject) => {
      const timestamp = (new Date().getTime() / 1000).toFixed(0);
      const text = vault.OS_API_KEY + timestamp + vault.OS_API_SECRET;
      const token = await bcrypt.hash(text, 10);

      const body = {
        app_key: vault.OS_API_KEY,
        timestamp: parseInt(timestamp),
        token: token,
        perm: {
          group: "secret.vault",
          dataType: "key",
          version: "v1",
          ops: ["Sign"],
        },
      };

      const accessToken = () =>
        new Promise<string>((result, reject) => {
          try {
            needle.post(
              `http://${vault.SERVER_URL}/permission/v1alpha1/access`,
              body,
              {
                headers: {
                  "Content-Type": "application/json",
                },
              },
              (err, resp) => {
                console.log("error:", err);
                console.log("resp:", resp.body);

                if (err) {
                  reject();
                } else {
                  result(resp.body.data.access_token);
                }
              }
            );
          } catch (error) {
            console.error(error);
            return;
          }
        });

      const sign = (txData: any, at: string, evmConfig: EvmConfig) =>
        new Promise((result, reject) => {
          try {
            needle.post(
              `http://${vault.SERVER_URL}/system-server/v1alpha1/key/secret.vault/v1/Sign`,
              {
                safe_type: "UNSAFE",
                chain_type: "EVM",
                data: {
                  sign_type: "CONTRACT_ENCODING_COMPLETED",
                  secert_id: secert_id,
                  to_address: txData.to,
                  chain_id: ethers.BigNumber.from(evmConfig.chain_id)
                    .toHexString()
                    .substring(2),
                  nonce: ethers.BigNumber.from(txData.nonce)
                    .toHexString()
                    .substring(2),
                  is1155: false,
                  gas_limit: txData.gasLimit.toHexString().substring(2),
                  gas_price: ethers.BigNumber.from(txData.gasPrice)
                    .toHexString()
                    .substring(2),
                  transaction_data: txData.data.substring(2),
                  amount: ethers.BigNumber.from(txData.value)
                    .toHexString()
                    .substring(2),
                },
              },
              {
                headers: {
                  "Content-Type": "application/json",
                  // "Content-Type": "application/x-www-form-urlencoded",
                  "X-Access-Token": at,
                },
              },
              (err, resp) => {
                console.log("error:", err);
                console.log("resp:", resp?.body);

                if (
                  !err &&
                  resp.body != undefined &&
                  resp.body.data != undefined &&
                  resp.body.data.data != undefined &&
                  resp.body.data.data.data != undefined
                ) {
                  result(resp.body.data.data.data);
                } else {
                  reject();
                }
              }
            );
          } catch (error) {
            console.error(error);
            return;
          }
        });

      const at: string = await accessToken();
      const resp = await sign(txData, at, evmConfig);
      result(resp);
    });

  test_sign = (txData: any, evmConfig: EvmConfig) =>
    new Promise((result, reject) => {
      try {
        needle.post(
          dev.sign.sign_url as string,
          {
            safe_type: "UNSAFE",
            chain_type: "EVM",
            data: {
              sign_type: "CONTRACT_ENCODING_COMPLETED",
              secert_id: dev.sign.wallet_id,
              to_address: txData.to,
              chain_id: ethers.BigNumber.from(evmConfig.chain_id)
                .toHexString()
                .substring(2),
              nonce: ethers.BigNumber.from(txData.nonce)
                .toHexString()
                .substring(2),
              is1155: false,
              gas_limit: txData.gasLimit.toHexString().substring(2),
              gas_price: ethers.BigNumber.from(txData.gasPrice)
                .toHexString()
                .substring(2),
              transaction_data: txData.data.substring(2),
              amount: ethers.BigNumber.from(txData.value)
                .toHexString()
                .substring(2),
            },
          },
          // {
          //     headers: {
          //         "Content-Type": "application/json"
          //     }
          // },
          (err, resp) => {
            console.log("error:", err);
            console.log("resp:", resp?.body);

            if (
              !err &&
              resp.body != undefined &&
              resp.body.data != undefined &&
              resp.body.data.data != undefined
            ) {
              result(resp.body.data.data);
            } else {
              reject();
            }
          }
        );
      } catch (error) {
        console.error(error);
        return;
      }
    });
  private async sendTransaction(
    lfirst: TransactionRequestCC,
    lfirstData: TransactionRequestCC
  ) {
    SystemOut.debug("send new transaction");
    //get gas_price
    const gas_price = await this.paddingListHolder.getDynamicGasPrice();
    if (gas_price == "-2") {
      SystemOut.error("Gas is too high, refusing transaction.");
      return;
    }
    if (gas_price == "-1") {
      delete lfirst.gasPrice;
    } else {
      lfirst.gasPrice = gas_price;
    }
    let provider: any;
    return new Promise((resolve) => {
      asyncLib.waterfall(
        [
          (callback: Function) => {
            (async () => {
              try {
                provider = new ethers.providers.JsonRpcProvider(
                  this.evmConfig.rpc_url
                );
                callback(null);
              } catch (e) {
                SystemOut.error(e);
                callback(
                  new SendTransactionError(
                    0,
                    `init provider error:${e.toString()}`
                  )
                );
              }
            })()
          },
          (callback: Function) => {
            (async () => {
              lfirst.value = ethers.BigNumber.from(lfirst.value);
              lfirst.gasLimit = 500000;
              callback(null);
            })()
          },
          (callback: Function) => {
            (async () => {
              try {
                const gas_limit = await provider.estimateGas(
                  lfirst as TransactionRequest
                );
                lfirst.gasLimit = gas_limit.add(10000);
                callback(null, { needAllowance: false });
              } catch (err) {
                if (
                  err.reason ==
                  "execution reverted: ERC20: insufficient allowance" ||
                  err.reason ==
                  "execution reverted: ERC20: transfer amount exceeds allowance" ||
                  err.reason ==
                  "execution reverted: BEP20: transfer amount exceeds allowance"
                ) {
                  callback(null, { needAllowance: true });
                } else {
                  callback(
                    new SendTransactionError(
                      0,
                      `estimateGas error:${err.toString()}`
                    )
                  );
                }
              }
            })()
          },
          (allowanceInfo: { needAllowance: boolean }, callback: Function) => {
            (async () => { // If necessary, carry out the operation.
              if (allowanceInfo.needAllowance == false) {
                callback(null);
                return;
              }
              try {
                await this.paddingListHolder.jumpApprove(lfirstData);
                callback(
                  new SendTransactionError(4, "loop execute on next tick")
                );
              } catch (err: any) {
                callback(new SendTransactionError(3, err.toString()));
              }
            })()
          }
          ,
          (callback: Function) => {
            (async () => {
              try {
                let transactionSended;
                if (
                  (dev.dev && dev.dev_sign) ||
                  (await this.wallet.isVault(lfirst.from))
                ) {
                  console.log("Vault account Transaction");
                  const provider = new ethers.providers.JsonRpcProvider(
                    this.evmConfig.rpc_url
                  );
                  const nonce = await provider.getTransactionCount(lfirst.from);
                  lfirst.nonce = nonce;

                  const secert_id = await this.wallet.getWallet(lfirst.from);
                  if (secert_id == undefined)
                    throw new Error("state error secert_id undefined");

                  const signed = await this.vaultSign(
                    lfirst,
                    this.evmConfig,
                    secert_id as string
                  );

                  transactionSended = await provider.sendTransaction(
                    signed as string
                  );
                } else {
                  console.log("Key account Transaction");
                  let client: any = await this.wallet.getWallet(lfirst.from);
                  if (client == undefined) throw new Error("client undefined");

                  client = (client as ethers.Wallet).connect(provider);
                  transactionSended = await client.sendTransaction(lfirst);
                }
                SystemOut.debug("transactionSended:", transactionSended);

                lfirstData.transactionHash = transactionSended.hash;
                lfirstData.sended = transactionSended;
                await this.paddingListHolder.updateTransactionNow(lfirstData);
                this.failNum = 0;
                callback(null, lfirstData);
              } catch (err: any) {
                callback(
                  new SendTransactionError(
                    1,
                    `send Transaction error:${err.toString()}`
                  )
                );
              }
            })()
          },
        ],
        (err) => {
          resolve(true);
          if (!err) {
            SystemOut.debug("transaction send sucess");
            return;
          }
          SystemOut.debug("🚨");
          SystemOut.error(err);
          SystemBus.emit("🚨", err);
          console.log("this.failNum:", this.failNum);
          this.failNum++;
          if (this.failNum >= 5) {
            lfirstData.error = err;
            this.paddingListHolder.onTransactionFailed(lfirstData);
            this.failNum = 0;
          }
        }
      );
    });
  }
  private async getTransactionReceipt(
    lfirst: TransactionRequestCC,
    lfirstData: TransactionRequestCC
  ) {
    return new Promise((resolve) => {
      async.waterfall(
        [
          (callback: Function) => {
            (async (callback: Function) => {
              try {
                console.log(
                  `[key point] [${this.getTransactionReceiptFailNum}] get transactionReceipt , transactionHash:`,
                  lfirst.transactionHash
                );
                const provider = new ethers.providers.JsonRpcProvider(
                  this.evmConfig.rpc_url
                );
                const transactionReceipt = await provider.getTransactionReceipt(
                  lfirst.transactionHash
                ); //
                SystemOut.info("transactionReceipt:", transactionReceipt);
                if (
                  transactionReceipt != undefined &&
                  transactionReceipt != null
                ) {
                  lfirstData.transactionReceipt = transactionReceipt;
                  if (transactionReceipt.status == 1) {
                    this.paddingListHolder.onTransactionNowSucceed(lfirstData);
                  } else {
                    //TODO Throws Error
                    this.pushErrorMessage(
                      `transaction execution failed ,receipt status is not [1]`
                    );
                  }
                }
              } catch (e) {
                this.pushErrorMessage(`transaction execution failed`);
                SystemOut.error(
                  `get [${lfirst.transactionHash}] transactionReceipt error:`,
                  e
                );
              } finally {
                callback(null);
              }
            })(callback)
          }

        ],
        (err) => {
          resolve(true);
          if (!lfirstData.transactionReceipt) {
            this.getTransactionReceiptFailNum++;
            if (
              this.getTransactionReceiptFailNum >
              MAX_GET_TRANSACTION_RECEIPT_NUMBER
            ) {
              lfirstData.error = `get receipt timeout`;
              this.paddingListHolder.onTransactionFailed(lfirstData);
              // systemOutput.debug(lfirstData)
              SystemOut.error("receipt get faild");
            }
            return;
          }
          SystemOut.debug("Receipt data:");
          console.log(lfirstData.transactionReceipt);
        }
      );
      // getTransactionReceiptFailNum
    });
  }
  check = async () => {
    const lfirstDataString = this.paddingListHolder.getFirst();
    if (lfirstDataString == undefined) {
      setTimeout(() => {
        LOOP_STATUS_LOG.log(
          `Transaction Loop still running`, `${new Date().toISOString().replace(/T/, ' ').substring(0, 23)}`
        );
        this.check();
      }, 3000);
      return;
    }
    const lfirstData: TransactionRequestCC = JSON.parse(lfirstDataString);
    const lfirst: TransactionRequestCC = {} as TransactionRequestCC;
    Object.assign(lfirst, lfirstData);
    delete lfirst.rawData;

    //dev test
    // lfirst.transactionHash = "0xb5e12372396142bc6d02a60e66607060cf8e455ee339c6b4e67a7d2c66cb6227"

    SystemOut.debug("lfirst:");
    SystemOut.debug(lfirst);

    lfirst.chainId =
      typeof lfirst.chainId === "string"
        ? parseInt(lfirst.chainId)
        : lfirst.chainId;

    if (lfirst.transactionHash == undefined) {
      this.getTransactionReceiptFailNum = 0;
      await this.sendTransaction(lfirst, lfirstData);
    } else {
      await this.getTransactionReceipt(lfirst, lfirstData);
    }
    setTimeout(() => {
      LOOP_STATUS_LOG.log(
        `Transaction Loop still running ${new Date().getTime()}`
      );
      this.check();
    }, 2000);
  };
}

export default class TransactionManager {
  redis: Redis | undefined;
  wallet: Wallet | undefined;
  evmConfig: EvmConfig | undefined;
  localPaddingList: string[] | undefined;
  getDynamicGasPriceFunction: Function;
  private getDynamicGasPriceFunctionResult: string = null; // {id:2,result:"0x23"}
  private dotnetEnable: boolean = false;
  rpcGas: string = null;
  checkLoop: TransactionCheckLoop | undefined;
  constructor() { }

  private initDotnet() {
    this.dotnetEnable = true;
    SystemOut.info(path.join(baseNetAppPath, "Newtonsoft.Json.dll"));
    this.getDynamicGasPriceFunction = edge.func({
      source: fs.readFileSync(
        path.join(__dirname, "../../", "dotnet/StartUp/Libarary.cs"),
        { encoding: "utf-8" }
      ),
      references: [
        path.join(baseNetAppPath, "Newtonsoft.Json.dll"),
        path.join(
          __dirname,
          "../../dotnet/StartUp/bin/Debug/net7.0/EdgeJs.dll"
        ),
        "System",
        "System.dll",
        "mscorlib.dll",
        "System.Net.Http.dll",
        "System.Numerics.dll",
        "System.Private.Uri.dll",
        "System.Net.Primitives.dll",
      ],
    });
  }
  private initLocalGasPrice() {
    this.getDynamicGasPriceFunction = async (input: any, callback: any) => {
      const requestObject: any = {
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1,
      };

      SystemOut.info("request ", input.rpcUrl, "method", "eth_gasPrice");
      const [err, response] = await to(axios.post(input.rpcUrl, requestObject, {
        timeout: 3000,
        headers: {
          "Content-Type": "application/json",
        },
      }));
      if (err) {
        callback(new Error(`get gasPriceError ${err.toString()}`), null);
        return
      }
      if (!response || !response.data) {
        callback(new Error("Invalid response received."), null)
        return
      }
      callback(null, JSON.stringify(_.get(response, "data", "{}")));
    };
  }
  public async getDynamicGasPrice() {
    let useDefaultGas = false;
    let stopTrade = false;

    const maxGasPrice = getMaxGasPrice(this.evmConfig);
    const rpcGas = this.rpcGas;
    if (maxGasPrice == "-1") {
      SystemOut.warn("No maximum gas set, using def value.");
      useDefaultGas = true;
    }
    try {
      if (new BN(rpcGas).toString() == "NaN") {
        SystemOut.warn("Processing gas error, using default value.");
        useDefaultGas = true;
      } else if (new BN(rpcGas).comparedTo(new BN(maxGasPrice)) > 0) {
        SystemOut.warn("Gas is too high, no longer trading.");
        useDefaultGas = true;
        stopTrade = true;
      }
    } catch (e) {
      useDefaultGas = true;
      SystemOut.warn("Processing gas error, using default value.");
    }

    let gasPrice;
    if (stopTrade == true) {
      SystemOut.warn("🚨🚨 stop trade ");
      gasPrice = "-2";
      return;
    }
    if (useDefaultGas) {
      gasPrice = (await getGasPrice("", this.evmConfig)).toString();
    } else {
      gasPrice = rpcGas;
    }
    if (gasPrice == "-1") {
      SystemOut.warn("🚨🚨 default gas not set ,use auto gas ");
      return;
    }
    SystemOut.debug(
      `tx gas is:`,
      gasPrice,
      `${ethers.utils.formatUnits(gasPrice, "gwei")}Gwei`
    );
    return gasPrice;
  }
  private async updateDynamicGasPrice() {
    try {
      const rpcResponse = JSON.parse(this.getDynamicGasPriceFunctionResult);
      //   console.log(rpcResponse);
      if (
        _.get(rpcResponse, "id", 0) > 0 &&
        _.get(rpcResponse, "result", null) != null
      ) {
        const sourcePrice = new BN(_.get(rpcResponse, "result", ""), 16);
        const tenPercent = sourcePrice.div(new BN(10));
        const increasedByTenPercent = sourcePrice.plus(tenPercent);
        this.rpcGas = increasedByTenPercent.toFixed(0).toString(); // "100000000000000000000000000";
        SystemOut.debug(`rpcGas set`, `[dotnet:${this.dotnetEnable}]:`, this.rpcGas);
      }
    } catch (e) {
      SystemOut.error(e);
    }
  }
  private async keepDynamicGasPrice() {
    const next = () => {
      setTimeout(() => {
        this.keepDynamicGasPrice();
      }, 1000 * 10);
    }
    const [err, gasResult]: [Error, string] = await to(new Promise((resolve, reject) => {
      this.getDynamicGasPriceFunction(
        { rpcUrl: this.evmConfig.rpc_url, method: "getGasPrice" },
        (err: Error, result: string) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        }
      );
    }));
    if (err) {
      SystemOut.error("get Gas error:", err);
      next();
      return;
    }
    this.getDynamicGasPriceFunctionResult = gasResult;
    this.updateDynamicGasPrice();
    next();
  }
  setConfig = async (
    redis: Redis,
    wallet: Wallet,
    evmRpcClient: EvmRpcClient,
    evmConfig: EvmConfig
  ) => {
    if (_.get(process, "env.USE_DOTNET", "false") === "true") {
      this.initDotnet();
    } else {
      this.initLocalGasPrice();
    }

    this.redis = redis;
    this.localPaddingList = [];
    this.wallet = wallet;
    this.evmConfig = evmConfig;

    CACHE_KEY_LOCAL_PADDING_LIST = `${CACHE_KEY_LOCAL_PADDING_LIST}_${evmConfig.system_chain_id}`;
    CACHE_KEY_LOCAL_SUCCEED_LIST = `${CACHE_KEY_LOCAL_SUCCEED_LIST}_${evmConfig.system_chain_id}`;
    CACHE_KEY_LOCAL_FAILED_LIST = `${CACHE_KEY_LOCAL_FAILED_LIST}_${evmConfig.system_chain_id}`;

    if (evmConfig.clear_padding == true) {
      await this.redis.del(CACHE_KEY_LOCAL_PADDING_LIST);
    }

    const num = await this.redis.llen(CACHE_KEY_LOCAL_PADDING_LIST);
    this.localPaddingList = await this.redis.lrange(
      CACHE_KEY_LOCAL_PADDING_LIST,
      0,
      num
    );
    console.log("localPaddingList:");
    console.log(this.localPaddingList);
    await this.keepDynamicGasPrice();
    this.checkLoop = new TransactionCheckLoop(
      wallet,
      this,
      evmRpcClient,
      evmConfig
    );
  };

  onTransactionFailed = async (transactionData: TransactionRequestCC) => {
    if (this.redis == undefined)
      throw new Error("db state error redis undefined");
    if (this.localPaddingList == undefined)
      throw new Error("state error localPaddingList undefined");

    const transactionDataStr = JSON.stringify(transactionData);
    await this.redis.blpop(CACHE_KEY_LOCAL_PADDING_LIST, 1);
    await this.redis.rpush(CACHE_KEY_LOCAL_FAILED_LIST, transactionDataStr);
    this.localPaddingList.shift();
  };

  onTransactionNowSucceed = async (transactionData: TransactionRequestCC) => {
    if (this.redis == undefined)
      throw new Error("db state error redis undefined");
    if (this.localPaddingList == undefined)
      throw new Error("state error localPaddingList undefined");

    const transactionDataStr: string = JSON.stringify(transactionData);
    await this.redis.blpop(CACHE_KEY_LOCAL_PADDING_LIST, 1);
    await this.redis.rpush(CACHE_KEY_LOCAL_SUCCEED_LIST, transactionDataStr);
    this.localPaddingList.shift();
  };

  updateTransactionNow = async (transactionData: TransactionRequestCC) => {
    if (this.redis == undefined)
      throw new Error("db state error redis undefined");
    if (this.localPaddingList == undefined)
      throw new Error("state error localPaddingList undefined");

    this.localPaddingList[0] = JSON.stringify(transactionData);
    await this.redis.blpop(CACHE_KEY_LOCAL_PADDING_LIST, 1);
    await this.redis.lpush(
      CACHE_KEY_LOCAL_PADDING_LIST,
      this.localPaddingList[0]
    );
  };

  jumpApprove = async (transaction: TransactionRequestCC) => {
    if (this.localPaddingList == undefined)
      throw new Error("state error localPaddingList undefined");
    if (this.evmConfig == undefined)
      throw new Error("state error evmConfig undefined");
    if (this.wallet == undefined)
      throw new Error("state error wallet undefined");
    if (this.redis == undefined)
      throw new Error("db state error redis undefined");

    console.log("jumpApprove");

    const walletInfos = await this.wallet.getWalletInfo();
    if (walletInfos == undefined)
      throw new Error("state error walletInfos undefined");
    if (transaction.rawData == undefined)
      throw new Error("state error transaction.rawData undefined");
    if (transaction.rawData.token == undefined)
      throw new Error("state error transaction.rawData.token undefined");

    const token = ethers.BigNumber.from(transaction.rawData.token).toHexString();
    const wallet = walletInfos.filter((info) => {
      if (transaction.rawData == undefined)
        throw new Error("state error transaction.rawData undefined");

      return (
        info.token.toLowerCase() == token.toLowerCase() &&
        info.wallet_name == transaction.rawData.sender_wallet_name
      );
    })[0];

    console.log("token:", token);
    console.log("balance:", (wallet.balance_value as BigNumberish).toString());

    const c = new ethers.Contract(
      token,
      this.evmConfig.abi.erc20,
      new ethers.providers.JsonRpcProvider(this.evmConfig.rpc_url)
    );
    try {
      const allowance = await c.allowance(wallet.wallet_address, transaction.to);

      if (
        new BN((allowance as BigNumber).toString()).comparedTo(
          transaction.rawData["token_amount"]
        ) == -1
      ) {
        console.log("allowance not enough");
      } else {
        console.log("allowance enough");
        return;
      }
    } catch (error) {
      console.log("allowance error");
      console.log(error);
      return;
    }

    const erc20Interface = new ethers.utils.Interface(this.evmConfig.abi.erc20);
    const calldata = erc20Interface.encodeFunctionData("approve", [
      transaction.to,
      wallet.balance_value,
    ]);

    const transactionRequest = {
      to: token,
      from: wallet.wallet_address,
      data: calldata,
      value: 0,
      gasPrice: transaction.gasPrice,
      chainId: this.evmConfig.chain_id,
    };

    this.localPaddingList.unshift(JSON.stringify(transactionRequest));
    await this.redis.lpush(
      CACHE_KEY_LOCAL_PADDING_LIST,
      this.localPaddingList[0]
    );
  };

  getFirst = () => {
    if (this.localPaddingList == undefined) return undefined;

    return this.localPaddingList.length > 0
      ? this.localPaddingList[0]
      : undefined;
  };

  getPaddingList = async () => { };

  sendTransactionLocalPadding = async (
    transactionRequest: TransactionRequestCC
  ) => {
    if (this.redis == undefined)
      throw new Error("db state error redis undefined");
    if (this.localPaddingList == undefined)
      throw new Error("state error localPaddingList undefined");

    const newTransactionRequest = JSON.stringify(transactionRequest);
    await this.redis.rpush(CACHE_KEY_LOCAL_PADDING_LIST, newTransactionRequest);
    this.localPaddingList.push(newTransactionRequest);
  };

  //Content to be optimized
  sendTransactionChainPadding = async () => { };

  //Content to be optimized
  sendTransactionFastest = async () => { };

  cancelPaddingTransaction = async () => { };

  getStatus = async () => {
    return {
      padding: this.localPaddingList,
    };
  };
}
