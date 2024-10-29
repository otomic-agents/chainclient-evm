import Koa from 'koa'
import Router from '@koa/router'
import ethers, { BigNumber } from 'ethers'
import { Client } from "@open-rpc/client-js";

export interface EvmRpcClient {
    get: () => Client
    saveBlack: () => void
    saveBlackTemporary: () => void
}

export interface EventFilterData {
    topic_string: string
    event_data: any
}

export interface SyncerConfig {
    status_key: string
}

export interface EvmConfig {
    start_top_height: string
    clear_padding: boolean
    rpc_url: string
    contract_address: string
    contract_reputation: string
    system_chain_id: string
    chain_id: string
    start_block: string
    transfer_out: EventFilterData
    transfer_in: EventFilterData
    confirm_out: EventFilterData
    confirm_in: EventFilterData
    refunded_out: EventFilterData
    refunded_in: EventFilterData
    submit_complaint: EventFilterData
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
    vault_name: string;
    wallet_name: string
    address: string
    type: string
    web3Wallet: ethers.Wallet
    private_key: string
    secert_id: string
    token_list: string[]
    can_sign_712: boolean
}

export interface CommandTransfer {
    token: string
    sender_wallet_name: string
    token_amount: string
}

export interface CommandTransferIn {
    sender_wallet_name: string
    user_receiver_address: string
    token: string
    token_amount: string
    eth_amount: string
    hash_lock: string
    src_chain_id: string
    src_transfer_id: string
    agreement_reached_time: string
    expected_single_step_time: string
    tolerant_single_step_time: string
    earliest_refund_time: string
}

export interface CommandTransferConfirm {
    sender: string
    sender_wallet_name: string
    user_receiver_address: string
    token: string
    token_amount: string
    eth_amount: string
    hash_lock: string
    preimage: string
    agreement_reached_time: string
    expected_single_step_time: string
    tolerant_single_step_time: string
    earliest_refund_time: string
}

export interface CommandTransferRefund {
    sender_wallet_name: string
    user_receiver_address: string
    token: string
    token_amount: string
    eth_amount: string
    hash_lock: string
    agreement_reached_time: string
    expected_single_step_time: string
    tolerant_single_step_time: string
    earliest_refund_time: string
}

export interface CommandTransferOutConfirm {
    sender: string
    user_receiver_address: string
    token: string
    token_amount: string
    eth_amount: string
    hash_lock: string
    relay_hash_lock: string
    preimage: string
    relay_preimage: string
    agreement_reached_time: string
    expected_single_step_time: string
    tolerant_single_step_time: string
    earliest_refund_time: string
}

export interface CommandTransferOutRefund {
    sender: string
    user_receiver_address: string
    token: string
    token_amount: string
    eth_amount: string
    hash_lock: string
    agreement_reached_time: string
    expected_single_step_time: string
    tolerant_single_step_time: string
    earliest_refund_time: string
}

export interface GasInfo {
    gas_price: string
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
    error: any;
}

export interface BlockFetchTask {
    step: number
    block_start: number
    block_end: number
    event_data: any
}

export interface FilterInfo {
    filter_id: string
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
    Reputation: string | undefined
}

export interface CallbackUrlBox {
    on_transfer_out: string | undefined
    on_transfer_in: string | undefined
    on_confirm_out: string | undefined
    on_confirm_in: string | undefined
    on_refunded_out: string | undefined
    on_refunded_in: string | undefined
    on_reputation: string | undefined
    on_height_update: string | undefined
}

export type KoaCtx = Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext & Router.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>, unknown>