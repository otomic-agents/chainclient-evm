import { ethers, BigNumber } from 'ethers'
import { Redis } from 'ioredis'
import { EvmConfig, EvmRpcClient, WalletConfig } from '../interface/interface'
import { SystemOut } from '../utils/systemOut'
import { ISignBase } from '../interface/wallet'
import axios from 'axios';
import * as _ from "lodash";
import Config from '../config/Config'
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
  private walletSecrets: WalletConfig[]
  wallet_info: TokenBalance[] | undefined

  setConfig = async (redis: Redis, evmRpcClient: EvmRpcClient, evmConfig: EvmConfig) => {
    this.redis = redis
    this.evmRpcClient = evmRpcClient
    this.evmConfig = evmConfig
    this.provider = new ethers.providers.JsonRpcProvider(evmConfig.rpc_url)
    this.tokenMap = {}
    const walletsCacheKey: string = `${CACHE_KEY_walletSecrets}_${evmConfig.system_chain_id}`;
    SystemOut.debug("wallet cached key ==", walletsCacheKey)
    const cachedSecretsStr = await this.redis.get(walletsCacheKey)
    if (!cachedSecretsStr) {
      this.walletSecrets == undefined
      SystemOut.warn("walletSecrets is empty")
      return;
    }
    try {
      this.walletSecrets = JSON.parse(cachedSecretsStr)
      await this.syncBalance()
    } catch (error) {
      console.error('set config syscBalance error:', error)
      this.walletSecrets = undefined
    }
  }

  public async updateWallet(walletSecrets: any) {
    if (this.redis == undefined) throw new Error('db state error')
    if (this.evmConfig == undefined) throw new Error('config state error')
    SystemOut.debug(walletSecrets)
    this.redis.set(`${CACHE_KEY_walletSecrets}_${this.evmConfig.system_chain_id}`, JSON.stringify(walletSecrets))
    this.walletSecrets = walletSecrets
  }

  getWalletInfo = async (onlyGet = false) => {
    if (onlyGet == false) {
      await this.syncBalance()
    }
    return this.wallet_info
  }
  public getWalletItemByWalletName(walletName: string): WalletConfig {
    const result = _.find(this.walletSecrets, (wallet) => wallet.wallet_name.toLowerCase() === walletName.toLocaleLowerCase());
    return result;
  }
  public getWalletItemByAddress(address: string): WalletConfig {
    const result = _.find(this.walletSecrets, (wallet) => wallet.address.toLowerCase() === address.toLocaleLowerCase());
    return result;
  }
  public getSignatureServiceAddress(address: string): string {
    const result = _.find(this.walletSecrets, (wallet) => wallet.address.toLowerCase() === address.toLocaleLowerCase());
    if (!result) {
      SystemOut.warn("⚠️ SignatureServiceAddress not found");
      return "";
    }
    return result.signature_service_address;
  }

  public getSignatureServiceAddressByWalletName(walletName: string): string {
    const result = _.find(this.walletSecrets, (wallet) => wallet.wallet_name.toLowerCase() === walletName.toLocaleLowerCase());
    if (!result) {
      SystemOut.warn("⚠️ SignatureServiceAddress not found");
      return "";
    }
    return result.signature_service_address;
  }

  getAddress = async (wallet_name: string) => {
    if (this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
      throw new Error('state error, no wallet in chainclient')
    }

    let address: string | undefined = undefined
    this.walletSecrets.forEach((wallet) => {
      if (wallet.wallet_name == wallet_name) {
        address = wallet.address
      }
    })
    return address
  }

  syncBalance = async () => {
    if (this.walletSecrets == null || this.walletSecrets == undefined || typeof this.walletSecrets === 'string') {
      throw new Error('state error, no wallet in chainclient')
    }

    const balance_list: TokenBalance[] = []

    this.walletSecrets.forEach((wallet) => {
      if (!wallet.type) {
        console.warn('type field cannot be empty')
        return
      }

      wallet.token_list.forEach((token) => {
        balance_list.push({
          wallet_name: wallet.wallet_name,
          token,
          wallet_address: wallet.address,
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

  private getSignBaseData(signData: any): ISignBase {
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
    return {
      domain,
      typedData
    }
  }
  private getSingleChainSignBaseData(signData: any): ISignBase {
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
          { name: 'expected_single_step_time', type: 'uint256' }
        ],
      },
      primaryType: 'Message',
      domain,
      message: signData,
    }
    return {
      domain,
      typedData
    }
  }
  signMessage712 = async (signData: any, walletName: string): Promise<string> => {
    const walletItem = this.getWalletItemByWalletName(walletName)
    let signed = ""
    const { domain, typedData } = this.getSignBaseData(signData);
    try {
      SystemOut.info("domain", domain)
      SystemOut.info("types", typedData.types)
      SystemOut.info("signData", signData)
      SystemOut.info("address", walletItem.address)
      signed = await this.getSignFromSignService(walletItem, { domain, typedData }, signData)
      SystemOut.info("signed  data is:", signed, domain)
      SystemOut.info("domain", domain)
    } catch (e) {
      SystemOut.info("The signature has an error")
      SystemOut.error(e)
    }
    return signed;
  }
  signSingleChainMessage712 = async (signData: any, walletName: string): Promise<string> => {
    const walletItem = this.getWalletItemByWalletName(walletName)
    let signed = ""
    const { domain, typedData } = this.getSingleChainSignBaseData(signData);
    try {
      SystemOut.info("domain", domain)
      SystemOut.info("types", typedData.types)
      SystemOut.info("signData", signData)
      SystemOut.info("address", walletItem.address)
      signed = await this.getSignFromSignService(walletItem, { domain, typedData }, signData)
      SystemOut.info("signed  data is:", signed, domain)
      SystemOut.info("domain", domain)
    } catch (e) {
      SystemOut.info("The signature has an error")
      SystemOut.error(e)
    }
    return signed;
  }

  private async getSignFromSignService(walletItem: WalletConfig, baseData: ISignBase, signData: any): Promise<string> {
    let signStr = ""
    try {
      const url = `${walletItem.signature_service_address}/lp/${Config.evm_config.system_chain_id}/signEIP712`
      const signResponse = await axios.post(url, {
        domain: baseData.domain,
        types: baseData.typedData.types,
        signData: signData
      })
      const responseData = _.get(signResponse, "data.signature", "")
      console.log("signed is:", responseData)
      signStr = responseData
    } catch (e) {
      SystemOut.error(e)
      throw e;
    }
    return signStr
  }

  getStatus = async () => {
    return this.wallet_info
  }
  /**
   * By default, relay uses the first wallet
   * @returns 
   */
  getRelayAddress = async () => {
    console.log("getRelayAddress:", this.walletSecrets);
    if (this.walletSecrets[0] == undefined) {
      throw new Error('no secret')
    }
    return this.walletSecrets[0].address
  }
  getRelayWalletName = async (): Promise<any>=> {
    console.log("getRelayAddress:", this.walletSecrets);
    if (this.walletSecrets[0] == undefined) {
      throw new Error('no secret')
    }
    return this.walletSecrets[0].wallet_name
  }
}
