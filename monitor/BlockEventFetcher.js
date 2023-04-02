
const get_events = async (evmRpcClient, from, to, callback) => {
        
    let result
    try {
        result = await evmRpcClient.get().request({"jsonrpc":"2.0","method":"eth_getLogs","params":[{"fromBlock":from,"toBlock":to}],"id":0}, 0);
    } catch (error) {
        console.error('get_events error')
        console.error('from:', from)
        console.error('to:', to)
        console.error(error)
        callback(error, null)
        return
    }
    callback(null, result)
}

const startFetchEvent = (evmRpcClient, block_fetch_task) => {
    let createEventFetcher = () => {
        console.log('create event fetcher')
        let run = async () => {

            let task = undefined
            for(let i = 0; i < block_fetch_task.length; i++){
                if(block_fetch_task[i].step == 1){
                    task = block_fetch_task[i]
                    break;
                }
            }

            if(task == undefined) {
                setTimeout(() => run(), 1000)
                return
            }
            task.step = 2

            // console.log('fetcher task')
            // console.log(task)

            await get_events(evmRpcClient, `0x${(task.block_start).toString(16)}`, `0x${(task.block_end).toString(16)}`, (err, result) => {
                if(!err){
                    // console.log('get_events result')
                    // console.log(result)
                    task.event_data = result
                    task.step = 3
                    setTimeout(run, 1)
                } else {
                    task.step = 1
                    setTimeout(run, 1)
                    
                    console.log(err)
                    console.log(result)
                }
            })

        }

        return {
            run
        }
    }

    let fetchers = []
    while(fetchers.length < 3){
        let fetcher = createEventFetcher()
        fetcher.run()
        fetchers.push(fetcher)
    }

}

class BlockEventFetcher {
    constructor(_monitor){
        this.monitor = _monitor
    }

    startFetch = async () => {
        if(this.monitor.fetch_block_running == true){
            throw new Error("task fetch block exist, but start new one")
        }
        this.monitor.fetch_block_running = true
        console.log('startFetch')

        if(this.monitor.task_block_event_now == undefined){
            this.monitor.task_block_event_now = Number(this.monitor.evm_config.start_block)
        }
        console.log('task_block_event_now:', this.monitor.task_block_event_now)

        if(this.monitor.block_fetch_task == undefined){
            this.monitor.block_fetch_task = []
        }

        let block_fetch_task = this.monitor.block_fetch_task
        let self = this

        console.log('create dispatcher')
        let dispatch = async () => {

            //check task number
            let task_number = 0
            block_fetch_task.forEach(element => {
                if(element.step != 3) task_number++
            });
            if(task_number < 10){
                //fetch height
                await self.blockHeight((err, result) => {
                    if(!err) self.monitor.block_height = parseInt(result, 16) - 12 //prevent chasing uncles

                    // self.monitor.block_height = 24231044
                    // console.log('height:', self.monitor.block_height)
                })

                //create block object
                while(self.monitor.block_height > self.monitor.task_block_event_now 
                    && task_number < 100){

                    let block_start = self.monitor.task_block_event_now + 1
                    let block_end = self.monitor.block_height - self.monitor.task_block_event_now > 10 ? self.monitor.task_block_event_now + 10 : self.monitor.block_height
                    block_fetch_task.push({
                        step:           1,// 1:wait 2:fetching 3:finished
                        event_data:     undefined,
                        block_start,
                        block_end,   
                    })
                    self.monitor.task_block_event_now = block_end
                    task_number ++

                }

            }

            setTimeout(dispatch, 5000)
        }
        dispatch()
        startFetchEvent(this.monitor.evmRpcClient, block_fetch_task)
    }

    blockHeight = async (callback) => {
        let result
        try {
            // console.log('fetch height')
            result = await this.monitor.evmRpcClient.get().request({"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":0}, 0)
        } catch (error) {
            console.error(error)
            callback(error, null)
            return
        }
        callback(null, result)
    }
}

module.exports = BlockEventFetcher