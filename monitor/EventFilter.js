const Web3EthAbi = require("web3-eth-abi");

class EventFilter{
    constructor(_monitor){
        this.monitor = _monitor
        this.dispatcher_event_list = []

        let self = this
        const dispatcher = async () => {
            let block_fetch_task = self.monitor.block_fetch_task
            while(block_fetch_task[0]?.step == 3){
                let task = block_fetch_task.shift()
                self.dispatcher_event_list.forEach(obj => {
                    obj.event_list.push(task)
                })
            }
        }
        setInterval(dispatcher, 3000);
    }

    startFilter = async (filter_info, callback) => {

        const dispatcher_data_holder = {
            filter_info,
            event_list: []
        }
        this.dispatcher_event_list.push(dispatcher_data_holder)

        let self = this
        let checkEvent = async () => {

            let block_fetch_task = dispatcher_data_holder.event_list
            while(block_fetch_task[0]?.step == 3){

                let task = block_fetch_task.shift()
                let events = task.event_data.filter(event => {
                    // console.log(event.topics[0])
                    // console.log(filter_info.topic_string)
                    return event.topics[0] == filter_info.topic_string
                })

                // console.log(task)
                // console.log('hit events')
                // console.log(events)
                
                events.forEach(async log => {
                    
                    let tx
                    try {
                        tx = await self.monitor.evmRpcClient.get().request({ "jsonrpc": "2.0", "method": "eth_getTransactionReceipt", "params": [log.transactionHash], "id": 0 })
                    } catch (error) {
                        console.error(error)
                    }
                    
                    let eventParse = Web3EthAbi.decodeLog(filter_info.event_data.inputs, log.data, log.topics.slice(1))

                    callback({
                        event: log,
                        tx,
                        eventParse
                    })
                })
                
                if(events.length > 0){
                    await self.monitor.update_height(parseInt(events[events.length - 1].blockNumber, 16))
                } else {
                    try {
                        await self.monitor.update_height(parseInt(task.event_data[task.event_data.length - 1].blockNumber, 16)) 
                    } catch (error) {
                        console.log('event_data length error')
                    }
                    
                }
                
            }

            setTimeout(checkEvent, 1000 * 3)
        }
        checkEvent()
    }
}

module.exports = EventFilter