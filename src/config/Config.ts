import OBridgeABI from './OtmoicV2ABI'
import Erc20ABI from './Erc20ABI'

export default {
    server_config : {
        port : process.env.EVM_CLIENT_PORT,//dev relay 9100
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
        clear_padding       : process.env.CLEAR_PADDING === 'true',
        rpc_url             : process.env.RPC_URL,
        contract_address    : process.env.CONTRACT_ADDRESS,
        system_chain_id     : process.env.SYSTEM_CHAIN_ID,
        chain_id            : process.env.CHAIN_ID,
        start_block         : process.env.START_BLOCK,
        transfer_out        : {
            topic_string    : "0x6f23424d5b4b46b615e9bc626f50d7a009696e3c66ccc5c98a7c0f64ca0850c5",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogNewTransferOut" && item.type == "event")[0]
        },
        transfer_in         : {
            topic_string    : "0xb404f6c3a389ecc657909242c386f01829f911f7a2b87aeefda2f99ff71b4ee8",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogNewTransferIn" && item.type == "event")[0]
        },
        confirm_out         : {
            topic_string    : "0xa97507b360853b32823c08fab936a2fda59be9d10546dc57cf24bfb9983ffabc",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferOutConfirmed" && item.type == "event")[0]            
        },
        confirm_in          : {
            topic_string    : "0xb159ce7fabaa0a8069cb6f5df091ea5de4c9ed97074b87000dd8e8ec0eef35dd",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferInConfirmed" && item.type == "event")[0]            
        },
        refunded_out        : {
            topic_string    : "0x2d8d59b9e17fe6a421c8b5b59fdc102b506210b116e72c9ad64cb95da671be44",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferOutRefunded" && item.type == "event")[0]            
        },
        refunded_in         : {
            topic_string    : "LogTransferInRefunded-topic0",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferInRefunded" && item.type == "event")[0]            
        },
        abi                 : {
            erc20           : Erc20ABI.abi,
            obridge         : OBridgeABI.abi
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
        
    }
}