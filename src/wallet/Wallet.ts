import ethers, { BigNumber } from 'ethers'
import { Redis } from 'ioredis'
import { EvmConfig, EvmRpcClient, TokenInfo, WalletConfig } from '../interface/interface'
import sleep from '../serverUtils/Sleeper'

const CACHE_KEY_walletSecrets = "CACHE_KEY_walletSecrets"

interface TokenDictionary {
    [key: string]: ethers.Contract
}

interface TokenBalance {
    wallet_name: string
    wallet_address: string
    token: TokenInfo
    decimals: number | undefined
    balance_value: BigNumber | undefined
}

export default class Wallet {

    redis: Redis | undefined
    evmRpcClient: EvmRpcClient | undefined
    evmConfig: EvmConfig | undefined
    provider: ethers.providers.JsonRpcProvider | undefined
    tokenMap: TokenDictionary | undefined
    walletSecrets: WalletConfig[] | string | null | undefined
    wallet_info: TokenBalance[] | undefined

    setConfig = async(redis: Redis, evmRpcClient: EvmRpcClient, evmConfig: EvmConfig) => {
        this.redis = redis
        this.evmRpcClient = evmRpcClient
        this.evmConfig = evmConfig
        this.provider = new ethers.providers.JsonRpcProvider(evmConfig.rpc_url);
        this.tokenMap = {}

        this.walletSecrets = await this.redis.get(`${CACHE_KEY_walletSecrets}_${evmConfig.system_chain_id}`)
        if(this.walletSecrets == undefined){
            this.walletSecrets = undefined
        } else {
            this.walletSecrets = JSON.parse(this.walletSecrets)
            try {
                await this.syncBalance()
            } catch (error) {
                this.walletSecrets = undefined
            }

        }
    }

    isVault = (address: string) => new Promise<boolean>((resolve, reject) => {
        if ( this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
            throw new Error('state error, no wallet in chainclient')
        }

        this.walletSecrets.forEach(wallet => {
            if (wallet.type == "key") {
                if (wallet.web3Wallet.address.toLowerCase() == address.toLowerCase()) {
                    resolve(false)
                }
            }
            else
            if (wallet.type == "vault") {
                if (wallet.address.toLowerCase() == address.toLowerCase()) {
                    resolve(true)
                }
            }
        })
    })

    getWallet = async (address: string) => {
        if ( this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
            throw new Error('state error, no wallet in chainclient')
        }

        let client = undefined
        this.walletSecrets.forEach(wallet => {

            if(wallet.type == "key" && wallet.web3Wallet.address.toLowerCase() == address.toLowerCase()){
                client = wallet.web3Wallet
            }
            else
            if (wallet.type == "vault" && wallet.address.toLowerCase() == address.toLowerCase()){
                client = wallet.secert_id
            }
        })
        return client
    }

    updateWallet = async (walletSecrets: any) => {

        //log wallet info & check walletSecrets format
        walletSecrets.forEach((element: any) => {
            console.log(`set wallet:`)
            console.log(element)
        });

        if (this.redis == undefined) throw new Error("db state error");
        if (this.evmConfig == undefined) throw new Error("config state error");
        

        this.redis.set(`${CACHE_KEY_walletSecrets}_${this.evmConfig.system_chain_id}`, JSON.stringify(walletSecrets))
        this.walletSecrets = walletSecrets

    }

    getWalletInfo = async () => {
        await this.syncBalance()
        return this.wallet_info
    }

    getAddress = async (wallet_name: string) => {
        if ( this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
            throw new Error('state error, no wallet in chainclient')
        }

        let address: string | undefined = undefined
        this.walletSecrets.forEach(wallet => {
            if (wallet.type == "key") {
                if(wallet.wallet_name == wallet_name) address = wallet.web3Wallet.address
            }
            else
            if (wallet.type == "vault") {
                if(wallet.wallet_name == wallet_name) address = wallet.address
            }

        })
        return address
    }

    syncBalance = async () => {

        if ( this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
            throw new Error('state error, no wallet in chainclient')
        }

        let balance_list: TokenBalance[] = []

        console.log("syncBalance")
        console.log(this.walletSecrets)

        this.walletSecrets.forEach(wallet => {
            if (!wallet.type){
                console.warn("type field cannot be empty")
                return
            }
            if (wallet.web3Wallet == undefined && wallet.type == "key") {
                wallet.web3Wallet = new ethers.Wallet(wallet.private_key)
            }

            wallet.token_list.forEach(token => {
                balance_list.push({
                    "wallet_name": wallet.wallet_name,
                    token,
                    wallet_address: wallet.type == "key" ? wallet.web3Wallet.address : wallet.type == "vault" ? wallet.address : "",
                    decimals: undefined,
                    balance_value: undefined
                })
            })
        })

        let startCount = 0
        let endCount = 0
        balance_list.forEach(async balance => {

            if (this.provider == undefined) throw new Error("state error provider undefined");
            if (this.tokenMap == undefined) throw new Error("state error tokenMap undefined");
            if (this.evmConfig == undefined) throw new Error("state error evmConfig undefined");
            

            if (balance.token.token_id == ethers.constants.AddressZero) {
                balance.balance_value = await this.provider.getBalance(balance.wallet_address)
                balance.decimals = 18
            } else {

                if(this.tokenMap[balance.token.token_id] == undefined) {
                    this.tokenMap[balance.token.token_id] = new ethers.Contract(balance.token.token_id, this.evmConfig.abi.erc20, this.provider);
                }

                startCount++
                try {
                    balance.balance_value = await this.tokenMap[balance.token.token_id].balanceOf(balance.wallet_address)
                    if(balance.decimals == undefined) {
                        balance.decimals = await this.tokenMap[balance.token.token_id].decimals()
                    }
                } catch (error) {
                    console.error("fetch balance error")
                    console.error(error)
                }

                endCount++
            }
        })

        while (endCount < startCount) {
            await sleep(100)
        }

        this.wallet_info = balance_list
    }

    getStatus = async () => {
        return this.wallet_info
    }
}