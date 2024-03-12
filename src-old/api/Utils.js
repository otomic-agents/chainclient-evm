const needle = require('needle');

//config
const Config = require('../config/Config.js');

const createCallback = (url, type) => {
    return async (event) => {
        
        switch (type) {
            case "TransferOut":
                event.eventParse.transfer_id = event.eventParse.transferId
                event.eventParse.dst_chain_id = event.eventParse.dstChainId
                event.eventParse.bid_id = event.eventParse.bidId
                event.eventParse.dst_address = event.eventParse.dstAddress
                event.eventParse.hash_lock = event.eventParse.hashlock
                event.eventParse.time_lock = event.eventParse.timelock
                event.eventParse.dst_token = event.eventParse.tokenDst
                event.eventParse.dst_amount = event.eventParse.amountDst
                break;
            case "TransferIn":
                event.eventParse.transfer_id = event.eventParse.transferId
                event.eventParse.hash_lock = event.eventParse.hashlock
                event.eventParse.time_lock = event.eventParse.timelock
                event.eventParse.src_chain_id = event.eventParse.srcChainId
                event.eventParse.src_transfer_id = event.eventParse.srcTransferId
                break;
            case "Confirm":
                event.eventParse.transfer_id = event.eventParse.transferId
                break;
            case "Refund":
                event.eventParse.transfer_id = event.eventParse.transferId
                break;
            default:
                break;
        }
        event.transfer_info = JSON.stringify(event.tx)
        event.event_raw = JSON.stringify(event.event)
        event.event_parse = event.eventParse
        event.chain_id = Config.evm_config.system_chain_id
        
        console.log('on event callback')
        console.log(event)
        console.log(url)

        try {
            needle.post(url, event,
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                },
                (err, resp) => {
                console.log('error:', err)
                console.log('resp:', resp.body)
            })
        } catch (error) {
            console.error(error)
            return
        }
    }
}

const watchTransferOut = (monitor, url) => {

    filter_info = {
        contract_address    : Config.evm_config.contract_address,
        topic_string        : Config.evm_config.transfer_out.topic_string,
        event_data          : Config.evm_config.transfer_out.event_data
    }

    monitor.watch(filter_info, createCallback(url, "TransferOut"), {
        "TransferOut" : url
    })
}

const watchTransferIn = (monitor, url) => {

    filter_info = {
        contract_address    : Config.evm_config.contract_address,
        topic_string        : Config.evm_config.transfer_in.topic_string,
        event_data          : Config.evm_config.transfer_in.event_data
    }

    monitor.watch(filter_info, createCallback(url, "TransferIn"), {
        "TransferIn" : url
    })
}

const watchConfirm = (monitor, url) => {

    filter_info = {
        contract_address    : Config.evm_config.contract_address,
        topic_string        : Config.evm_config.confirm.topic_string,
        event_data          : Config.evm_config.confirm.event_data
    }

    monitor.watch(filter_info, createCallback(url, "Confirm"), {
        "Confirm" : url
    })
}

const watchRefund = (monitor, url) => {

    filter_info = {
        contract_address    : Config.evm_config.contract_address,
        topic_string        : Config.evm_config.refunded.topic_string,
        event_data          : Config.evm_config.refunded.event_data
    }

    monitor.watch(filter_info, createCallback(url, "Refund"), {
        "Refund" : url
    })
}

module.exports = {
    watchTransferOut,
    watchTransferIn,
    watchConfirm,
    watchRefund
}