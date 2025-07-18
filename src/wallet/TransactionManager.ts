import { BigNumber, BigNumberish, ethers } from "ethers";
import { Service, Inject } from "typedi";
import Wallet from "./Wallet";
import {
    EvmConfig,
    EvmRpcClient,
    TransactionRequestCC,
} from "../interface/interface";
import { Redis } from "ioredis";
import BN from "bignumber.js";
import { SystemOut } from "../utils/systemOut";
import * as _ from "lodash";
import GasManager from "./GasManager";
import TransactionCheckLoop from "./TransactionCheckLoop";

let CACHE_KEY_LOCAL_PADDING_LIST = "CACHE_KEY_LOCAL_PADDING_LIST";
let CACHE_KEY_LOCAL_SUCCEED_LIST = "CACHE_KEY_LOCAL_SUCCEED_LIST";
let CACHE_KEY_LOCAL_FAILED_LIST = "CACHE_KEY_LOCAL_FAILED_LIST";


@Service()
export default class TransactionManager {
    redis: Redis | undefined;
    wallet: Wallet | undefined;
    evmConfig: EvmConfig | undefined;
    localPaddingList: string[] | undefined;

    @Inject()
    public gasManager: GasManager;
    @Inject()
    transactionCheckLoop: TransactionCheckLoop;
    constructor() { }

    setConfig = async (
        redis: Redis,
        wallet: Wallet,
        evmRpcClient: EvmRpcClient,
        evmConfig: EvmConfig
    ) => {
        this.gasManager.setEvmConfig(evmConfig)
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
        // init TransactionCheckLoop
        this.transactionCheckLoop.init(
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

    pushApproveToQueue = async (transaction: TransactionRequestCC) => {
        SystemOut.info("Do Approve");
        const walletInfos = await this.wallet.getWalletInfo();
        const token = ethers.BigNumber.from(transaction.rawData.token).toHexString();
        const wallet = walletInfos.filter((info) => {
            if (transaction.rawData == undefined)
                throw new Error("state error transaction.rawData undefined");

            return (
                info.token.toLowerCase() == token.toLowerCase() &&
                info.wallet_name == transaction.rawData.sender_wallet_name
            );
        })[0];

        SystemOut.info("token:", token);
        SystemOut.info("balance:", ethers.BigNumber.from(wallet.balance_value as BigNumberish).toString());

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

    public getFirst() {
        if (this.localPaddingList == undefined) return undefined;

        return this.localPaddingList.length > 0
            ? this.localPaddingList[0]
            : undefined;
    };

    public getPaddingList() { };

    public async enqueueTransactionToLocalPadding(
        transactionRequest: TransactionRequestCC
    ): Promise<void> {
        if (this.redis == undefined) {
            throw new Error("db state error redis undefined");
        }
        if (this.localPaddingList == undefined) {
            throw new Error("state error localPaddingList undefined");
        }
        SystemOut.info("enqueueTransactionToLocalPadding")
        const newTransactionRequest = JSON.stringify(transactionRequest);
        await this.redis.rpush(CACHE_KEY_LOCAL_PADDING_LIST, newTransactionRequest);
        this.localPaddingList.push(newTransactionRequest);
    }


    //Content to be optimized
    enqueueTransactionToChainPadding = async () => { };

    //Content to be optimized
    enqueueTransactionToFastest = async () => { };

    cancelPaddingTransaction = async () => { };

    public getStatus() {
        return {
            padding: this.localPaddingList,
        };
    };
}
