import { ethers, BigNumber } from 'ethers'
import { Redis } from 'ioredis'
import { EvmConfig, EvmRpcClient, TokenInfo, WalletConfig } from '../interface/interface'
import sleep from '../serverUtils/Sleeper'
import { getKey } from '../serverUtils/SecretVaultUtils'

const CACHE_KEY_walletSecrets = "CACHE_KEY_walletSecrets"

interface TokenDictionary {
    [key: string]: ethers.Contract
}

interface TokenBalance {
    wallet_name: string
    wallet_address: string
    token: string
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
            if (wallet.type == "key" || wallet.type == "secret_vault") {
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

        let client: undefined | string | ethers.Wallet = undefined
        this.walletSecrets.forEach(wallet => {

            if((wallet.type == "key" || wallet.type == "secret_vault")&& wallet.web3Wallet.address.toLowerCase() == address.toLowerCase()){
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
            if (wallet.type == "key" || wallet.type == "secret_vault") {
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

        for (const wallet of this.walletSecrets) {
            if (wallet.web3Wallet == undefined && wallet.type == "secret_vault") {
                wallet.private_key = await getKey(wallet.vault_name)
            }
        }

        this.walletSecrets.forEach(wallet => {
            if (!wallet.type){
                console.warn("type field cannot be empty")
                return
            }
            if (wallet.web3Wallet == undefined && wallet.type == "key") {
                wallet.web3Wallet = new ethers.Wallet(wallet.private_key)
            }

            if (wallet.web3Wallet == undefined && wallet.type == "secret_vault") {
                
                wallet.web3Wallet = new ethers.Wallet(wallet.private_key)
            }

            wallet.token_list.forEach(token => {
                balance_list.push({
                    "wallet_name": wallet.wallet_name,
                    token,
                    wallet_address: (wallet.type == "key" || wallet.type == "secret_vault") ? wallet.web3Wallet.address : wallet.type == "vault" ? wallet.address : "",
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
            

            if (balance.token == ethers.constants.AddressZero) {
                
                balance.balance_value = await this.provider.getBalance(balance.wallet_address)
                balance.decimals = 18
            } else {

                if(this.tokenMap[balance.token] == undefined) {
                    console.log('token_id', balance.token)
                    this.tokenMap[balance.token] = new ethers.Contract(balance.token, this.evmConfig.abi.erc20, this.provider);
                }

                startCount++
                try {
                    console.log('fetch', balance.wallet_address)
                    balance.balance_value = await this.tokenMap[balance.token].balanceOf(balance.wallet_address)
                    console.log('balance', balance.balance_value)
                    if(balance.decimals == undefined) {
                        balance.decimals = await this.tokenMap[balance.token].decimals()
                        console.log('decimals', balance.decimals)
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

    signMessage712 = async (signData: any, wallet_name: string) => {
        if ( this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
            throw new Error('state error, no wallet in chainclient')
        }

        let signed = undefined
        for (const wallet of this.walletSecrets) {
            if (wallet.can_sign_712 && (wallet.type == "key" || wallet.type == "secret_vault")) {
                const domain = {
                    name: 'OtmoicSwap',
                    version: '1',
                    chainId: this.evmConfig.chain_id,
                };

                const typedData = {
                    types: {
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
                    },
                    primaryType: 'Message',
                    domain,
                    message: signData,
                };

                signed = await wallet.web3Wallet._signTypedData(domain, typedData.types, signData)
            }
        }
        
        return signed
    }

    getStatus = async () => {
        return this.wallet_info
    }

    getRelayAddress = async () => {

        if (this.walletSecrets[0] == undefined) {
            throw new Error("no secret");
            
        } else {
            console.log(JSON.stringify(this.walletSecrets[0] as any))
            return (this.walletSecrets[0] as any ).web3Wallet.address
        }
    }
}