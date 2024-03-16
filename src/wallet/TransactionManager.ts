import { BigNumberish, BytesLike, ethers } from "ethers";
import needle from "needle"
import bcrypt from "bcrypt"

import Wallet from "./Wallet"

import Config from "../config/Config"
import { EvmConfig, EvmRpcClient, TransactionRequestCC } from "../interface/interface";
import { Redis } from "ioredis";
import { AccessListish } from "ethers/lib/utils";
const { dev, vault } = Config

let CACHE_KEY_LOCAL_PADDING_LIST = "CACHE_KEY_LOCAL_PADDING_LIST"
let CACHE_KEY_LOCAL_SUCCEED_LIST = "CACHE_KEY_LOCAL_SUCCEED_LIST"
let CACHE_KEY_LOCAL_FAILED_LIST = "CACHE_KEY_LOCAL_FAILED_LIST"

const getGasPrice = async (flag: string, evmConfig: EvmConfig) => {
    switch (evmConfig.system_chain_id) {
        case "9006"://BSC
            if (evmConfig.chain_id === '97')
                return 10000000010;
            else
                return 5000000010;
        case "9000"://AVAX
            return 26000000010;
        case "60":
            return -1;
        case "966":
            return -1;
        default:
            break;
    }
}

export type TransactionRequest = {
    to?: string,
    from?: string,
    nonce?: BigNumberish,

    gasLimit?: BigNumberish,
    gasPrice?: BigNumberish,

    data?: BytesLike,
    value?: BigNumberish,
    chainId?: number

    type?: number;
    accessList?: AccessListish;

    maxPriorityFeePerGas?: BigNumberish;
    maxFeePerGas?: BigNumberish;

    customData?: Record<string, any>;
    ccipReadEnabled?: boolean;
}

class TransactionCheckLoop {

    wallet: Wallet
    paddingListHolder: TransactionManager
    evmRpcClient: EvmRpcClient
    evmConfig: EvmConfig
    failNum: number

    constructor(wallet: Wallet, paddingListHolder: TransactionManager, evmRpcClient: EvmRpcClient, evmConfig: EvmConfig){
        this.wallet = wallet
        this.paddingListHolder = paddingListHolder
        this.evmRpcClient = evmRpcClient
        this.evmConfig = evmConfig
        this.failNum = 0

        this.check()
    }

    vaultSign = (txData: any, evmConfig: EvmConfig, secert_id: string) => new Promise(async (result, reject) => {

        let timestamp = (new Date().getTime() / 1000).toFixed(0);
        let text = vault.OS_API_KEY + timestamp + vault.OS_API_SECRET;
        let token = await bcrypt.hash(text, 10);

        let body = {
            "app_key": vault.OS_API_KEY,
            "timestamp": parseInt(timestamp),
            "token": token,
            "perm": {
              "group": "secret.vault",
              "dataType": "key",
              "version": "v1",
              "ops": ["Sign"]
            }
        }

        let accessToken = () => new Promise<string>((result, reject) => {
            try {
                
                needle.post(`http://${vault.SERVER_URL}/permission/v1alpha1/access`, body,
                    {
                        headers: {
                            "Content-Type": "application/json"
                        }
                    },
                    (err, resp) => {
                    console.log('error:', err)
                    console.log('resp:', resp.body)

                    if (err) {
                        reject()
                    } else {
                        result(resp.body.data.access_token)
                    }

                })
            } catch (error) {
                console.error(error)
                return
            }
        })

        let sign = (txData: any, at: string, evmConfig: EvmConfig) => new Promise((result, reject) => {
            try {
                needle.post(`http://${vault.SERVER_URL}/system-server/v1alpha1/key/secret.vault/v1/Sign` ,
                    {
                        "safe_type": "UNSAFE",
                        "chain_type": "EVM",
                        "data": {
                            "sign_type": "CONTRACT_ENCODING_COMPLETED",
                            "secert_id": secert_id,
                            "to_address": txData.to,
                            "chain_id": ethers.BigNumber.from(evmConfig.chain_id).toHexString().substring(2),
                            "nonce": ethers.BigNumber.from(txData.nonce).toHexString().substring(2),
                            "is1155": false,
                            "gas_limit": txData.gasLimit.toHexString().substring(2),
                            "gas_price": ethers.BigNumber.from(txData.gasPrice).toHexString().substring(2),
                            "transaction_data": txData.data.substring(2),
                            "amount": ethers.BigNumber.from(txData.value).toHexString().substring(2)
                        }
                    },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            // "Content-Type": "application/x-www-form-urlencoded",
                            'X-Access-Token': at
                        }
                    },
                    (err, resp) => {
                    console.log('error:', err)
                    console.log('resp:', resp?.body)

                    if(!err && resp.body != undefined && resp.body.data != undefined && resp.body.data.data != undefined && resp.body.data.data.data != undefined) {
                        result(resp.body.data.data.data)
                    } else {
                        reject()
                    }

                })
            } catch (error) {
                console.error(error)
                return
            }
        })

        let at: string = await accessToken();
        let resp = await sign(txData, at, evmConfig);
        result(resp)

    })

    test_sign = (txData: any, evmConfig: EvmConfig) => new Promise((result, reject) => {
        try {
            needle.post(dev.sign.sign_url as string,
                {
                    "safe_type": "UNSAFE",
                    "chain_type": "EVM",
                    "data": {
                        "sign_type": "CONTRACT_ENCODING_COMPLETED",
                        "secert_id": dev.sign.wallet_id,
                        "to_address": txData.to,
                        "chain_id": ethers.BigNumber.from(evmConfig.chain_id).toHexString().substring(2),
                        "nonce": ethers.BigNumber.from(txData.nonce).toHexString().substring(2),
                        "is1155": false,
                        "gas_limit": txData.gasLimit.toHexString().substring(2),
                        "gas_price": ethers.BigNumber.from(txData.gasPrice).toHexString().substring(2),
                        "transaction_data": txData.data.substring(2),
                        "amount": ethers.BigNumber.from(txData.value).toHexString().substring(2)
                    }
                },
                // {
                //     headers: {
                //         "Content-Type": "application/json"
                //     }
                // },
                (err, resp) => {
                console.log('error:', err)
                console.log('resp:', resp?.body)

                if(!err && resp.body != undefined && resp.body.data != undefined && resp.body.data.data != undefined) {
                    result(resp.body.data.data)
                } else {
                    reject()
                }

            })
        } catch (error) {
            console.error(error)
            return
        }
    })

    check = async() => {

        const lfirstDataString = this.paddingListHolder.getFirst()
        if(lfirstDataString == undefined){
            setTimeout(this.check, 3000)
            return
        }
        const lfirstData: TransactionRequestCC = JSON.parse(lfirstDataString)
        let lfirst: TransactionRequestCC = {} as TransactionRequestCC
        Object.assign(lfirst, lfirstData)
        delete lfirst.rawData

        //dev test
        // lfirst.transactionHash = "0xb5e12372396142bc6d02a60e66607060cf8e455ee339c6b4e67a7d2c66cb6227"

        console.log("lfirst:")
        console.log(lfirst)

        lfirst.chainId =  typeof lfirst.chainId === 'string' ? parseInt(lfirst.chainId) : lfirst.chainId
        //check tx state
        //switch send
        //or
        //wait(check state) and update DB
        if(lfirst.transactionHash == undefined) {
            console.group("send new transaction")
            //get gas_price
            let gas_price = await getGasPrice(lfirst.gasPrice as string, this.evmConfig)
            if (gas_price == -1) {
                delete lfirst.gasPrice
            } else {
                lfirst.gasPrice = gas_price
            }
            
            //get limit
            let provider = new ethers.providers.JsonRpcProvider(this.evmConfig.rpc_url)


            try {
                lfirst.value = ethers.BigNumber.from(lfirst.value)
                lfirst.gasLimit = 500000
                let gas_limit = await provider.estimateGas(lfirst as TransactionRequest)
                console.log("gas_limit:")
                console.log(gas_limit)

                lfirst.gasLimit = gas_limit.add(10000)
                console.log('lfirst:')
                console.log(lfirst)

                let transactionSended

                if ((dev.dev && dev.dev_sign) || await this.wallet.isVault(lfirst.from)) {
                    console.log("Vault account Transaction")
                    let provider = new ethers.providers.JsonRpcProvider(this.evmConfig.rpc_url)
                    let nonce = await provider.getTransactionCount(lfirst.from)
                    lfirst.nonce = nonce

                    // let signed = await this.test_sign(lfirst, this.evmConfig)

                    let secert_id = await this.wallet.getWallet(lfirst.from)
                    if (secert_id == undefined) throw new Error("state error secert_id undefined");

                    let signed = await this.vaultSign(lfirst, this.evmConfig, (secert_id as string))

                    transactionSended = await provider.sendTransaction(signed as string)

                } else {
                    console.log("Key account Transaction")
                    let client: any = await this.wallet.getWallet(lfirst.from)
                    if (client == undefined) throw new Error("client undefined");
                    
                    client = (client as ethers.Wallet).connect(provider)
                    transactionSended = await client.sendTransaction(lfirst)
                }


                console.log("transactionSended:")
                console.log(transactionSended)

                lfirstData.transactionHash = transactionSended.hash
                lfirstData.sended = transactionSended
                await this.paddingListHolder.updateTransactionNow(lfirstData)
                this.failNum = 0
            } catch (err: any) {
                if(
                    err.reason == "execution reverted: ERC20: insufficient allowance"
                || err.reason == "execution reverted: ERC20: transfer amount exceeds allowance"
                || err.reason == "execution reverted: BEP20: transfer amount exceeds allowance"
                || err.reason == "execution reverted"){
                    await this.paddingListHolder.jumpApprove(lfirstData)
                } else {
                    console.log('this.failNum:', this.failNum)
                    this.failNum++
                    if(this.failNum >= 5){
                        lfirstData.error = err
                        this.paddingListHolder.onTransactionFailed(lfirstData)
                        this.failNum = 0
                    }
                }
                console.error(err)
            }

            console.groupEnd()
        } else {
            console.log("transactionHash:", lfirst.transactionHash)
            let provider = new ethers.providers.JsonRpcProvider(this.evmConfig.rpc_url)
            let transactionReceipt = await provider.getTransactionReceipt(lfirst.transactionHash)
            console.log("transactionReceipt:")
            console.log(transactionReceipt)

            if(transactionReceipt != undefined && transactionReceipt != null){
                lfirstData.transactionReceipt = transactionReceipt

                if(transactionReceipt.status == 1) {
                    // update queue
                    this.paddingListHolder.onTransactionNowSucceed(lfirstData)

                } else {
                    //TODO Throws Error
                }
            }


        }


        setTimeout(this.check, 3000)
    }

}

export default class TransactionManager {

    redis: Redis | undefined
    wallet: Wallet | undefined
    evmConfig: EvmConfig | undefined
    localPaddingList: string[] | undefined

    checkLoop: TransactionCheckLoop | undefined
    constructor(){}

    setConfig = async (redis: Redis, wallet: Wallet, evmRpcClient: EvmRpcClient, evmConfig: EvmConfig) => {
        this.redis = redis
        this.localPaddingList = []
        this.wallet = wallet
        this.evmConfig = evmConfig

        CACHE_KEY_LOCAL_PADDING_LIST = `${CACHE_KEY_LOCAL_PADDING_LIST}_${evmConfig.system_chain_id}`
        CACHE_KEY_LOCAL_SUCCEED_LIST = `${CACHE_KEY_LOCAL_SUCCEED_LIST}_${evmConfig.system_chain_id}`
        CACHE_KEY_LOCAL_FAILED_LIST = `${CACHE_KEY_LOCAL_FAILED_LIST}_${evmConfig.system_chain_id}`

        if(evmConfig.clear_padding == true) {
            await this.redis.del(CACHE_KEY_LOCAL_PADDING_LIST)
        }

        let num = await this.redis.llen(CACHE_KEY_LOCAL_PADDING_LIST)
        this.localPaddingList = await this.redis.lrange(CACHE_KEY_LOCAL_PADDING_LIST, 0, num)
        console.log("localPaddingList:")
        console.log(this.localPaddingList)

        this.checkLoop = new TransactionCheckLoop(wallet, this, evmRpcClient, evmConfig)
    }

    onTransactionFailed = async (transactionData: TransactionRequestCC) => {

        if (this.redis == undefined) throw new Error("db state error redis undefined");
        if (this.localPaddingList == undefined) throw new Error("state error localPaddingList undefined");

        const transactionDataStr = JSON.stringify(transactionData)
        await this.redis.blpop(CACHE_KEY_LOCAL_PADDING_LIST, 1)
        await this.redis.rpush(CACHE_KEY_LOCAL_FAILED_LIST, transactionDataStr)
        this.localPaddingList.shift()
    }

    onTransactionNowSucceed = async (transactionData: TransactionRequestCC) => {

        if (this.redis == undefined) throw new Error("db state error redis undefined");
        if (this.localPaddingList == undefined) throw new Error("state error localPaddingList undefined");

        const transactionDataStr: string = JSON.stringify(transactionData)
        await this.redis.blpop(CACHE_KEY_LOCAL_PADDING_LIST, 1)
        await this.redis.rpush(CACHE_KEY_LOCAL_SUCCEED_LIST, transactionDataStr)
        this.localPaddingList.shift()
    }

    updateTransactionNow = async (transactionData: TransactionRequestCC) => {

        if (this.redis == undefined) throw new Error("db state error redis undefined");
        if (this.localPaddingList == undefined) throw new Error("state error localPaddingList undefined");

        this.localPaddingList[0] = JSON.stringify(transactionData)
        await this.redis.blpop(CACHE_KEY_LOCAL_PADDING_LIST, 1)
        await this.redis.lpush(CACHE_KEY_LOCAL_PADDING_LIST, this.localPaddingList[0])
    }

    jumpApprove = async (transaction: TransactionRequestCC) => {

        if (this.localPaddingList == undefined) throw new Error("state error localPaddingList undefined");
        if (this.evmConfig == undefined) throw new Error("state error evmConfig undefined");
        if (this.wallet == undefined) throw new Error("state error wallet undefined");
        if (this.redis == undefined) throw new Error("db state error redis undefined");
        
        console.log("jumpApprove")

        let walletInfos = await this.wallet.getWalletInfo()
        if (walletInfos == undefined) throw new Error("state error walletInfos undefined");
        if (transaction.rawData == undefined) throw new Error("state error transaction.rawData undefined");
        if (transaction.rawData.token == undefined) throw new Error("state error transaction.rawData.token undefined");

        let token = ethers.BigNumber.from(transaction.rawData.token).toHexString()
        let wallet = walletInfos.filter(info => {
            if (transaction.rawData == undefined) throw new Error("state error transaction.rawData undefined");

            return info.token.toLowerCase() == token.toLowerCase() && info.wallet_name == transaction.rawData.sender_wallet_name
        })[0]

        console.log("token:", token)
        console.log("balance:", (wallet.balance_value as BigNumberish).toString())

        let erc20Interface = new ethers.utils.Interface(this.evmConfig.abi.erc20)
        let calldata = erc20Interface.encodeFunctionData("approve", [
            transaction.to,
            wallet.balance_value
        ])

        let transactionRequest = {
            to          : token,
            from        : wallet.wallet_address,
            data        : calldata,
            value       : 0,
            gasPrice    : transaction.gasPrice,
            chainId     : this.evmConfig.chain_id,
        }

        this.localPaddingList.unshift(JSON.stringify(transactionRequest))
        await this.redis.lpush(CACHE_KEY_LOCAL_PADDING_LIST, this.localPaddingList[0])
    }

    getFirst = () => {
        if (this.localPaddingList == undefined) return undefined

        return this.localPaddingList.length > 0 ? this.localPaddingList[0] : undefined
    }

    getPaddingList = async () => {

    }

    sendTransactionLocalPadding = async (transactionRequest: TransactionRequestCC) => {

        if (this.redis == undefined) throw new Error("db state error redis undefined");
        if (this.localPaddingList == undefined) throw new Error("state error localPaddingList undefined");

        let newTransactionRequest = JSON.stringify(transactionRequest)
        await this.redis.rpush(CACHE_KEY_LOCAL_PADDING_LIST, newTransactionRequest)
        this.localPaddingList.push(newTransactionRequest)
    }

    //Content to be optimized
    sendTransactionChainPadding = async () => {

    }

    //Content to be optimized
    sendTransactionFastest = async () => {

    }

    cancelPaddingTransaction = async () => {

    }

    getStatus = async () => {
        return {
            padding : this.localPaddingList
        }
    }
}