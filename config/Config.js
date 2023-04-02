const OBridgeABI = require('./OBridgeABI')
const Erc20ABI = require('./Erc20ABI')

module.exports = {
    server_config : {
        port : process.env.EVM_CLIENT_PORT,//dev relay 9100
    },
    redis_config : {
        host    : process.env.REDIS_HOST,//dev relay:obridge-relay-db-redis-master    dev lp:obridge-lpnode-db-redis-master
        port    : process.env.REDIS_PORT,
        prefix  : '',
        db      : 4,
        statusDB: 9,
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
            topic_string    : "0x573e213380faa927b1c1335457fe327e653e0604ed6a2c2f878f06a042896511",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogNewTransferOut" && item.type == "event")[0]
        },
        transfer_in         : {
            topic_string    : "0x48e8c25194d6eb9633068bb38aea36f72e1c4b4d6e892ff556b8a63a803c2fd0",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogNewTransferIn" && item.type == "event")[0]
        },
        confirm             : {
            topic_string    : "0xb7ae890c7a4721f7ed769dabfeee74f0e0f5bcdaad9cab432ccea4d9fa435b50",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferConfirmed" && item.type == "event")[0]            
        },
        refunded            : {
            topic_string    : "0x70a8f332cabb778f79acc5b97cbb4543970a2f1a34bd0773e4b3012931f752dc",
            event_data      : OBridgeABI.abi.filter(item => item.name == "LogTransferRefunded" && item.type == "event")[0]            
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