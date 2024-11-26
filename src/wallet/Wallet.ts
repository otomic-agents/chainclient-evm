import { ethers, BigNumber } from 'ethers'
import { Redis } from 'ioredis'
import { EvmConfig, EvmRpcClient, WalletConfig } from '../interface/interface'
import sleep from '../serverUtils/Sleeper'
import { getKey } from '../serverUtils/SecretVaultUtils'
import { SystemOut } from '../utils/systemOut'

const CACHE_KEY_walletSecrets = 'CACHE_KEY_LP_walletSecrets'

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

  setConfig = async (redis: Redis, evmRpcClient: EvmRpcClient, evmConfig: EvmConfig) => {
    this.redis = redis
    this.evmRpcClient = evmRpcClient
    this.evmConfig = evmConfig
    this.provider = new ethers.providers.JsonRpcProvider(evmConfig.rpc_url)
    this.tokenMap = {}

    this.walletSecrets = await this.redis.get(`${CACHE_KEY_walletSecrets}_${evmConfig.system_chain_id}`)
    if (this.walletSecrets == undefined) {
      this.walletSecrets = undefined
    } else {
      this.walletSecrets = JSON.parse(this.walletSecrets)
      try {
        await this.syncBalance()
      } catch (error) {
        console.error('set config syscBalance error:', error)
        this.walletSecrets = undefined
      }
    }
  }

  isVault = (address: string) =>
    new Promise<boolean>((resolve) => {
      if (this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
        throw new Error('state error, no wallet in chainclient')
      }

      this.walletSecrets.forEach((wallet) => {
        if (wallet.type == 'key' || wallet.type == 'secret_vault') {
          if (wallet.web3Wallet.address.toLowerCase() == address.toLowerCase()) {
            resolve(false)
          }
        } else if (wallet.type == 'vault') {
          if (wallet.address.toLowerCase() == address.toLowerCase()) {
            resolve(true)
          }
        }
      })
    })

  getWallet = async (address: string) => {
    if (this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
      throw new Error('state error, no wallet in chainclient')
    }

    let client: undefined | string | ethers.Wallet = undefined
    this.walletSecrets.forEach((wallet) => {
      if ((wallet.type == 'key' || wallet.type == 'secret_vault') && wallet.web3Wallet.address.toLowerCase() == address.toLowerCase()) {
        client = wallet.web3Wallet
      } else if (wallet.type == 'vault' && wallet.address.toLowerCase() == address.toLowerCase()) {
        client = wallet.secert_id
      }
    })
    return client
  }

  updateWallet = async (walletSecrets: any) => {
    //log wallet info & check walletSecrets format
    walletSecrets.forEach((element: any) => {
      console.log(`set wallet:`)
    })

    if (this.redis == undefined) throw new Error('db state error')
    if (this.evmConfig == undefined) throw new Error('config state error')

    this.redis.set(`${CACHE_KEY_walletSecrets}_${this.evmConfig.system_chain_id}`, JSON.stringify(walletSecrets))
    this.walletSecrets = walletSecrets
  }

  getWalletInfo = async (onlyGet = false) => {
    if (onlyGet == false) {
      await this.syncBalance()
    }
    return this.wallet_info
  }

  getAddress = async (wallet_name: string) => {
    if (this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
      throw new Error('state error, no wallet in chainclient')
    }

    let address: string | undefined = undefined
    this.walletSecrets.forEach((wallet) => {
      if (wallet.type == 'key' || wallet.type == 'secret_vault') {
        if (wallet.wallet_name == wallet_name) address = wallet.web3Wallet.address
      } else if (wallet.type == 'vault') {
        if (wallet.wallet_name == wallet_name) address = wallet.address
      }
    })
    return address
  }

  syncBalance = async () => {
    if (this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
      throw new Error('state error, no wallet in chainclient')
    }

    const balance_list: TokenBalance[] = []

    // ⚠️  Warning: This area contains private keys
    // console.log(JSON.stringify(this.walletSecrets))
    try {
      for (const wallet of this.walletSecrets) {
        if (wallet.web3Wallet == undefined && wallet.type == 'secret_vault') {
          wallet.private_key = await getKey(wallet.vault_name)
        }
      }
    } catch (e) {
      SystemOut.error("sync balance error");
      SystemOut.warn("Restart in 30 seconds")
      await new Promise((resolve) => { setTimeout(() => { resolve(true) }, 1000 * 30) })
      process.exit()
    }


    this.walletSecrets.forEach((wallet) => {
      if (!wallet.type) {
        console.warn('type field cannot be empty')
        return
      }
      if (wallet.web3Wallet == undefined && wallet.type == 'key') {
        wallet.web3Wallet = new ethers.Wallet(wallet.private_key)
      }

      if (wallet.web3Wallet == undefined && wallet.type == 'secret_vault') {
        wallet.web3Wallet = new ethers.Wallet(wallet.private_key)
      }

      wallet.token_list.forEach((token) => {
        balance_list.push({
          wallet_name: wallet.wallet_name,
          token,
          wallet_address:
            wallet.type == 'key' || wallet.type == 'secret_vault'
              ? wallet.web3Wallet.address
              : wallet.type == 'vault'
                ? wallet.address
                : '',
          decimals: undefined,
          balance_value: undefined,
        })
      })
    })
    // console.log(balance_list)
    for (const balance of balance_list) {
      if (this.provider == undefined) throw new Error('state error provider undefined')
      if (this.tokenMap == undefined) throw new Error('state error tokenMap undefined')
      if (this.evmConfig == undefined) throw new Error('state error evmConfig undefined')

      if (balance.token == ethers.constants.AddressZero) {
        SystemOut.info('fetch native balance ', 'wallet:', balance.wallet_address, 'token:', balance.token)
        balance.balance_value = await this.provider.getBalance(balance.wallet_address)
        balance.decimals = 18
      } else {
        if (this.tokenMap[balance.token] == undefined) {
          SystemOut.debug('token_id', balance.token)
          this.tokenMap[balance.token] = new ethers.Contract(balance.token, this.evmConfig.abi.erc20, this.provider)
        }

        try {
          SystemOut.info('fetch balance ', 'wallet:', balance.wallet_address, 'token:', balance.token)
          // console.log(this.tokenMap);
          balance.balance_value = await this.tokenMap[balance.token].balanceOf(balance.wallet_address)
          if (balance.decimals == undefined) {
            balance.decimals = await this.tokenMap[balance.token].decimals()
          }
          SystemOut.debug(JSON.stringify(balance))
        } catch (error) {
          console.error('fetch balance error')
          console.error(error)
        }
      }
    }
    this.wallet_info = balance_list
  }

  signMessage712 = async (signData: any, wallet_name: string) => {
    if (this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
      throw new Error('state error, no wallet in chainclient')
    }

    let signed = undefined
    for (const wallet of this.walletSecrets) {
      if (wallet.can_sign_712 && (wallet.type == 'key' || wallet.type == 'secret_vault')) {
        const domain = {
          name: 'OtmoicSwap',
          version: '1',
          chainId: parseInt(this.evmConfig.chain_id),
        }
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
              { name: 'agreement_reached_time', type: 'uint256' },
              { name: 'expected_single_step_time', type: 'uint256' },
              { name: 'tolerant_single_step_time', type: 'uint256' },
              { name: 'earliest_refund_time', type: 'uint256' },
            ],
          },
          primaryType: 'Message',
          domain,
          message: signData,
        }
        try {
          SystemOut.info("domain", domain)
          SystemOut.info("types", typedData.types)
          SystemOut.info("signData", signData)
          SystemOut.info("address", wallet.web3Wallet.address)
          signed = await wallet.web3Wallet._signTypedData(domain, typedData.types, signData)
          SystemOut.info("signed  data is:", signed, domain)
          SystemOut.info("domain", domain)
        } catch (e) {
          SystemOut.info("The signature has an error")
          SystemOut.error(e)
        }

      }
    }

    return signed
  }

  getStatus = async () => {
    return this.wallet_info
  }

  getRelayAddress = async () => {
    if (this.walletSecrets[0] == undefined) {
      throw new Error('no secret')
    } else {
      // console.log(JSON.stringify(this.walletSecrets[0] as any))
      return (this.walletSecrets[0] as any).web3Wallet.address
    }
  }
}
