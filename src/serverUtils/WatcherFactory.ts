import needle from 'needle'
import Monitor from '../monitor/Monitor'
import { EvmConfig, FilterInfo } from '../interface/interface'


const createCallback = (url: string, type: string, config: EvmConfig) => {
    return async (event: any) => {
        
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
        event.chain_id = config.system_chain_id
        
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

export const watchTransferOut = (monitor: Monitor, url: string, config: EvmConfig) => {

    const filter_info: FilterInfo = {
        contract_address    : config.contract_address,
        topic_string        : config.transfer_out.topic_string,
        event_data          : config.transfer_out.event_data
    }

    monitor.watch(filter_info, createCallback(url, "TransferOut", config), {
        "TransferOut": url,
        TransferIn: undefined,
        Confirm: undefined,
        Refund: undefined
    })
}

export const watchTransferIn = (monitor: Monitor, url: string, config: EvmConfig) => {

    const filter_info: FilterInfo = {
        contract_address    : config.contract_address,
        topic_string        : config.transfer_in.topic_string,
        event_data          : config.transfer_in.event_data
    }

    monitor.watch(filter_info, createCallback(url, "TransferIn", config), {
        "TransferIn": url,
        TransferOut: undefined,
        Confirm: undefined,
        Refund: undefined
    })
}

export const watchConfirm = (monitor: Monitor, url: string, config: EvmConfig) => {

    const filter_info: FilterInfo = {
        contract_address    : config.contract_address,
        topic_string        : config.confirm.topic_string,
        event_data          : config.confirm.event_data
    }

    monitor.watch(filter_info, createCallback(url, "Confirm", config), {
        "Confirm": url,
        TransferOut: undefined,
        TransferIn: undefined,
        Refund: undefined
    })
}

export const watchRefund = (monitor: Monitor, url: string, config: EvmConfig) => {

    const filter_info: FilterInfo = {
        contract_address    : config.contract_address,
        topic_string        : config.refunded.topic_string,
        event_data          : config.refunded.event_data
    }

    monitor.watch(filter_info, createCallback(url, "Refund", config), {
        "Refund": url,
        TransferOut: undefined,
        TransferIn: undefined,
        Confirm: undefined
    })
}
