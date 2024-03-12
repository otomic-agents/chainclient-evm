import Koa from 'koa'
import Router from '@koa/router'
import ethers, { BigNumber } from 'ethers'
import { Client } from "@open-rpc/client-js";

export interface EvmRpcClient {
    get: () => Client
}

export interface EventFilterData {
    topic_string: string
    event_data: any
}

export interface SyncerConfig {
    status_key: string
}

export interface EvmConfig {
    clear_padding: boolean
    rpc_url: string
    contract_address: string
    system_chain_id: string
    chain_id: string
    start_block: string
    transfer_out: EventFilterData
    transfer_in: EventFilterData
    confirm: EventFilterData
    refunded: EventFilterData
    abi: {
        erc20: any,
        obridge: any
    }
}

export interface TokenInfo {
    create_receipt_id: string
    token_id: string
}

export interface WalletConfig {
    wallet_name: string
    address: string
    type: string
    web3Wallet: ethers.Wallet
    private_key: string
    secert_id: string
    token_list: TokenInfo[]
}

export interface CommandTransfer {
    token: string
    sender_wallet_name: string
}

export interface TransactionRequestCC {
    from: string
    to: string
    data: string
    rawData: CommandTransfer | undefined
    chainId: number | string
    transactionHash: string | undefined
    gasPrice: number | string | undefined
    value: BigNumber | string
    gasLimit: BigNumber | number | undefined
    nonce: number | undefined
    transactionReceipt: ethers.providers.TransactionReceipt | undefined
    sended: ethers.providers.TransactionResponse | undefined
    error: any
}

export interface BlockFetchTask {
    step: number
    block_start: number
    block_end: number
    event_data: any
}

export interface FilterInfo {
    contract_address: string
    topic_string: string
    event_data: any
}

export interface DispatcherDataHolder {
    filter_info: FilterInfo
    event_list: BlockFetchTask[]
}

export interface MonitorWatchStatusInfo {
    TransferOut: string | undefined
    TransferIn: string | undefined
    Confirm: string | undefined
    Refund: string | undefined
}

export type KoaCtx = Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext & Router.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>, unknown>