import OBridgeABI from './OtmoicV2ABI'
import Erc20ABI from './Erc20ABI'
import ReputationABI from './ReputationABI'
import { ethers } from 'ethers'

const ifaceObridge = new ethers.utils.Interface(OBridgeABI.abi);

const eventTxOutFragment = ifaceObridge.getEvent("LogNewTransferOut")
const topic0TxOut = ifaceObridge.getEventTopic(eventTxOutFragment)

const eventTxInFragment = ifaceObridge.getEvent("LogNewTransferIn")
const topic0TxIn = ifaceObridge.getEventTopic(eventTxInFragment)

const eventTxOutCfmFragment = ifaceObridge.getEvent("LogTransferOutConfirmed")
const topic0TxOutCfm = ifaceObridge.getEventTopic(eventTxOutCfmFragment)

const eventTxInCfmFragment = ifaceObridge.getEvent("LogTransferInConfirmed")
const topic0TxInCfm = ifaceObridge.getEventTopic(eventTxInCfmFragment)

const eventTxOutRfdFragment = ifaceObridge.getEvent("LogTransferOutRefunded")
const topic0TxOutRfd = ifaceObridge.getEventTopic(eventTxOutRfdFragment)

const eventTxInRfdFragment = ifaceObridge.getEvent("LogTransferInRefunded")
const topic0TxInRfd = ifaceObridge.getEventTopic(eventTxInRfdFragment)

const ifaceReputation = new ethers.utils.Interface(ReputationABI.abi);
const eventSubmitComplaintFragment = ifaceReputation.getEvent("SubmitComplaint")
const topic0SubmitComplaint = ifaceReputation.getEventTopic(eventSubmitComplaintFragment)

export default {
    server_config : {
        port : process.env.EVM_CLIENT_PORT,//dev relay 9100
        auto_start: process.env.AUTO_START,
        relay_wallet: process.env.RELAY_WALLET
    },
    redis_config : {
        host    : process.env.REDIS_HOST,//dev relay:obridge-relay-db-redis-master    dev lp:obridge-lpnode-db-redis-master
        port    : process.env.REDIS_PORT,
        prefix  : '',
        db      : 0,//4,
        statusDB: 0,//9,
        pwd     : process.env.REDIS_PASSWORD
    },
    evm_config : {
        start_top_height    : process.env.START_TOP_HEIGHT,
        clear_padding       : process.env.CLEAR_PADDING === 'true',
        rpc_url             : process.env.RPC_URL,
        rpc_url_preset      : process.env.RPC_URL,
        contract_address    : process.env.CONTRACT_ADDRESS,
        contract_reputation : process.env.CONTRACT_ADDRESS_REPUTATION,
        system_chain_id     : process.env.SYSTEM_CHAIN_ID,
        chain_id            : process.env.CHAIN_ID,
        start_block         : process.env.START_BLOCK,
        transfer_out        : {
            topic_string    : topic0TxOut,
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogNewTransferOut" && item.type == "event")[0]
        },
        transfer_in         : {
            topic_string    : topic0TxIn,
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogNewTransferIn" && item.type == "event")[0]
        },
        confirm_out         : {
            topic_string    : topic0TxOutCfm,
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferOutConfirmed" && item.type == "event")[0]            
        },
        confirm_in          : {
            topic_string    : topic0TxInCfm,
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferInConfirmed" && item.type == "event")[0]            
        },
        refunded_out        : {
            topic_string    : topic0TxOutRfd,
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferOutRefunded" && item.type == "event")[0]            
        },
        refunded_in         : {
            topic_string    : topic0TxInRfd,
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferInRefunded" && item.type == "event")[0]            
        },
        submit_complaint    : {
            topic_string    : topic0SubmitComplaint,
            event_data      : ReputationABI.abi.filter(item => item.name == "SubmitComplaint" && item.type == "event")[0]  
        },
        abi                 : {
            erc20           : Erc20ABI.abi,
            obridge         : OBridgeABI.abi,
            reputation      : ReputationABI.abi
        }     
    },
    syncer_config : {
        status_key    : process.env.STATUS_KEY
    },
    relay_server_url : {
        on_transfer_out : process.env.SERVER_URL_TRANSFER_OUT,
        on_transfer_in  : process.env.SERVER_URL_TRANSFER_IN,
        on_confirm      : process.env.SERVER_URL_CONFIRM,
        on_refunded     : process.env.SERVER_URL_REFUNDED
    },
    dev : {
        dev: process.env.DEV_ENABLE == 'true',
        dev_sign: process.env.DEV_SIGN_ENABLE == 'true',
        sign: {
            sign_url: process.env.DEV_SIGN_URL,
            wallet_id: process.env.DEV_SIGN_WALLET
        }
    },
    vault : {
        OS_API_KEY: process.env.OS_API_KEY,
        OS_API_SECRET: process.env.OS_API_SECRET,
        SERVER_URL: process.env.OS_SYSTEM_SERVER,
        
    },
    relay_wallet : [
        {
            account_id: '',
            address: process.env.RELAY_WALLET_ADDRESS,
            can_sign_712: true,
            private_key: process.env.RELAY_WALLET_PRIVATE_KEY,
            token_list: [],
            type: 'key',
            vault_host_type: '',
            vault_name: '',
            vault_secert_type: '',
            wallet_name: 'RelayWallet'
        }
    ]
}