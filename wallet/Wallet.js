const CACHE_KEY_WALLET_SECRETS = "CACHE_KEY_WALLET_SECRETS"
const { ethers } = require("ethers");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

class Wallet {
    constructor(){}

    setConfig = async(redis, evmRpcClient, evm_config) => {
        this.redis = redis
        this.evmRpcClient = evmRpcClient
        this.evm_config = evm_config
        this.provider = new ethers.providers.JsonRpcProvider(evm_config.rpc_url);
        this.token_map = {}

        this.wallet_secrets = await this.redis.get(`${CACHE_KEY_WALLET_SECRETS}_${evm_config.system_chain_id}`)
        if(this.wallet_secrets == undefined){
            this.wallet_secrets = undefined
        } else {
            this.wallet_secrets = JSON.parse(this.wallet_secrets)
            try {
                await this.syncBalance()
            } catch (error) {
                this.wallet_secrets = undefined
            }
            
        }
    }

    isVault = async (address) => {
        this.wallet_secrets.forEach(wallet => {
            if (wallet.type == "key") {
                if (wallet.web3Wallet.address.toLowerCase() == address.toLowerCase()) {
                    return false
                }
            }
            else 
            if (wallet.type == "vault") {
                if (wallet.address.toLowerCase() == address.toLowerCase()) {
                    return true
                }
            }
        })
    }

    getWallet = async (address) => {
        let client
        this.wallet_secrets.forEach(wallet => {

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

    updateWallet = async (wallet_secrets) => {

        //log wallet info & check wallet_secrets format
        wallet_secrets.forEach(element => {
            console.log(`set wallet:`)
            console.log(element)
        });

        this.redis.set(`${CACHE_KEY_WALLET_SECRETS}_${this.evm_config.system_chain_id}`, JSON.stringify(wallet_secrets))
        this.wallet_secrets = wallet_secrets

    }

    getWalletInfo = async () => {
        await this.syncBalance()
        return this.wallet_info
    }

    getAddress = async (wallet_name) => {
        let address = undefined
        this.wallet_secrets.forEach(wallet => {
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

        let balance_list = []

        console.log("syncBalance")
        console.log(this.wallet_secrets)

        this.wallet_secrets.forEach(wallet => {

            if (wallet.web3Wallet == undefined && wallet.type == "key") {
                wallet.web3Wallet = new ethers.Wallet(wallet.private_key)
            }

            wallet.token_list.forEach(token => {

                balance_list.push({
                    "wallet_name": wallet.wallet_name,
                    token,
                    wallet_address: wallet.type == "key" ? wallet.web3Wallet.address : wallet.type == "vault" ? wallet.address : ""
                })
            })
        })
        
        let startCount = 0
        let endCount = 0
        balance_list.forEach(async balance => {
            if (balance.token == ethers.constants.AddressZero) {
                balance.balance_value = await this.provider.getBalance(balance.wallet_address)
                balance.decimals = 18
            } else {

                if(this.token_map[balance.token] == undefined) {
                    this.token_map[balance.token] = new ethers.Contract(balance.token, this.evm_config.abi.erc20, this.provider);
                }

                startCount++
                try {
                    balance.balance_value = await this.token_map[balance.token].balanceOf(balance.wallet_address)
                    if(balance.decimals == undefined) {
                        balance.decimals = await this.token_map[balance.token].decimals()
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

module.exports = Wallet