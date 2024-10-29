import { BigNumber, BigNumberish, BytesLike, ethers } from "ethers";
import to from 'await-to-js';
import needle from "needle";
import bcrypt from "bcrypt";
import Wallet from "./Wallet";
import Config from "../config/Config";
import {
    EvmConfig,
    EvmRpcClient,
    TransactionRequestCC,
} from "../interface/interface";
import { Redis } from "ioredis";

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
import { getGasPrice, getMaxGasPrice } from "./TransactionManagerGas";
import { TransactionRequest } from "./TransactionManagerTypes";

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

    public constructor(
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
    public vaultSign(txData: any, evmConfig: EvmConfig, secert_id: string) {
        return new Promise(async (result, reject) => {
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
    }

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
        if (gas_price == "-1") { // use auto gas
            delete lfirst.gasPrice;
            SystemOut.info("Remove the gas; let the ethers library decide the gas itself.")
        } else { //  use def gas or rpc gas
            SystemOut.info("Use the default gas or the gas obtained from the RPC.")
            lfirst.gasPrice = gas_price;
        }
        let provider: any;
        SystemOut.info("🛍️ send transaction gasPrice", ethers.utils.formatUnits(lfirst.gasPrice, "gwei"))
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
                                    SystemOut.warn("The authorized amount is insufficient; push the authorization action to the queue.")
                                    callback(null, { needAllowance: true });
                                } else {
                                    callback(
                                        new SendTransactionError(
                                            0,
                                            `Pre-execution failed. estimateGas error:${err.toString()}`
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
                                    new SendTransactionError(4, "Loop execute on next tick ,Approve")
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
                                    SystemOut.info("Vault account Transaction");
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
                                    SystemOut.info("Key account Transaction");
                                    let client: any = await this.wallet.getWallet(lfirst.from);
                                    if (client == undefined) throw new Error("client undefined");

                                    client = (client as ethers.Wallet).connect(provider);
                                    transactionSended = await client.sendTransaction(lfirst);
                                }
                                SystemOut.info(`transactionSended`, "TxHash:", _.get(transactionSended, "hash", ""));
                                SystemOut.info(transactionSended)
                                SystemBus.sendAction({ action: "transaction_send", payload: _.clone(transactionSended) })
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
                        SystemOut.debug("Transaction sent successfully");
                        return;
                    }
                    SystemOut.warn("Transaction failed to send", this.failNum)
                    SystemOut.error(err);
                    SystemBus.emittery.emit("🚨", err);
                    SystemOut.warn("this.failNum:", this.failNum);
                    this.failNum++;
                    if (this.failNum >= 5) {
                        lfirstData.error = err;
                        SystemBus.sendAction({ action: "transaction_send_failed", payload: _.clone(lfirstData) })
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
                                if (!transactionReceipt) {
                                    SystemOut.info("Continue waiting for the receipt:", lfirst.transactionHash);
                                }
                                if (
                                    transactionReceipt != undefined &&
                                    transactionReceipt != null
                                ) {
                                    SystemOut.info("Transaction receipt retrieved successfully.", lfirst.transactionHash);
                                    lfirstData.transactionReceipt = transactionReceipt;
                                    if (transactionReceipt.status == 1) {
                                        this.paddingListHolder.onTransactionNowSucceed(lfirstData);
                                    } else {
                                        this.pushErrorMessage(
                                            `transaction execution failed ,receipt status is not [1]`
                                        );
                                    }
                                }
                            } catch (e) {
                                this.pushErrorMessage(`Transaction execution failed`);
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
                            SystemBus.sendAction({ action: "transaction_send_failed", payload: _.clone(lfirstData) })
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
    public async check() {
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

        lfirst.chainId =
            typeof lfirst.chainId === "string"
                ? parseInt(lfirst.chainId)
                : lfirst.chainId;


        if (lfirst.transactionHash == undefined) {
            this.getTransactionReceiptFailNum = 0;
            SystemOut.debug("Transaction Queue Data 【Send】:", lfirst);
            await this.sendTransaction(lfirst, lfirstData);
        } else {
            SystemOut.debug("Transaction Queue Data 【Waiting transactionReceipt】:", _.get(lfirst, "transactionHash"));
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

    rpcGas: string = null;
    checkLoop: TransactionCheckLoop | undefined;
    constructor() { }
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
    public async getDynamicGasPrice(): Promise<string> {
        let useDefaultGas = false;
        const maxGasPrice = getMaxGasPrice(this.evmConfig);
        const rpcGas = this.rpcGas;
        if (maxGasPrice == "-1") {
            SystemOut.warn("No maximum gas set, using def value.");
            useDefaultGas = true;
        }
        SystemOut.debug("maxGas", maxGasPrice, ethers.utils.formatUnits(maxGasPrice, "gwei"), "rpcGas", this.rpcGas, ethers.utils.formatUnits(rpcGas, "gwei"))
        try {
            if (new BN(rpcGas).toString() == "NaN") {
                SystemOut.warn("Processing gas error, using default value.");
                useDefaultGas = true;
            } else if (new BN(rpcGas).comparedTo(new BN(maxGasPrice)) > 0) {
                SystemOut.warn("rpcGas is too high ,use DefaultGas");
                useDefaultGas = true;
            }
        } catch (e) {
            useDefaultGas = true;
            SystemOut.warn("Processing gas error, using default value.");
        }

        let gasPrice;
        if (useDefaultGas) {
            gasPrice = (await getGasPrice("", this.evmConfig)).toString();
            if (gasPrice == "-1") {
                SystemOut.warn(" default gas not set ,use auto gas ");
                return "-1";
            } else {
                SystemOut.info("use default gas")
                return gasPrice
            }
        }
        SystemOut.info("use rpcGas")
        gasPrice = rpcGas;
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
                const increasedByTwentyPercent = sourcePrice.times(new BN(12)).div(new BN(10)); // * 1.2
                this.rpcGas = increasedByTwentyPercent.toFixed(0).toString(); // "100000000000000000000000000";
                SystemOut.debug(`rpcGas set`, this.rpcGas);
            }
        } catch (e) {
            SystemOut.error(e);
        }
    }
    private async keepDynamicGasPrice() {
        const next = () => {
            setTimeout(() => {
                this.keepDynamicGasPrice();
            }, 1000 * 20);
        }
        const [err, gasResult]: [Error, string] = await to(new Promise((resolve, reject) => {
            const callData = { rpcUrl: this.evmConfig.rpc_url, method: "getGasPrice" }
            this.getDynamicGasPriceFunction(
                JSON.parse(JSON.stringify(callData)),
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

        this.initLocalGasPrice();
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
        SystemOut.info("localPaddingList:", this.localPaddingList);
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

        SystemOut.info("Do Approve");

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

        try {
            if (
                new BN((wallet.balance_value as BigNumberish).toString()).comparedTo(
                    transaction.rawData["token_amount"]
                ) == -1
            ) {
                throw new Error("wallet balance not enough");
            }
        } catch (error) {
            throw new Error("compare wallet token balance with transaction token amount error");
        }

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
