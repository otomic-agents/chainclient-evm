const BlockEventFetcher = require('./BlockEventFetcher')
const EventFilter = require('./EventFilter')

const CACHE_KEY_EVENT_HEIGHT = "CACHE_KEY_EVENT_HEIGHT"

class Monitor {
    constructor(){
        this.status_watcher = []
    }

    setConfig = async (redis, evmRpcClient, evm_config) => {
        this.redis = redis
        this.evmRpcClient = evmRpcClient
        this.evm_config = evm_config
        
        let cache_height = await this.redis.get(`${CACHE_KEY_EVENT_HEIGHT}_${evm_config.system_chain_id}`)
        console.log('cache_key:', `${CACHE_KEY_EVENT_HEIGHT}_${evm_config.system_chain_id}`)
        console.log('cache_height:', cache_height)
        this.evm_config.start_block = cache_height == undefined ? this.evm_config.start_block : 
                                      parseInt(cache_height) > parseInt(this.evm_config.start_block) ? cache_height : this.evm_config.start_block

        this.status_block_height = this.evm_config.start_block
    }

    watch = (filter_info, callback, statusInfo) => {

        console.group('on watch')

        console.log('filter_info:')
        console.log(filter_info)

        if(this.blockEventFetcher == undefined){
            this.blockEventFetcher = new BlockEventFetcher(this)
            this.blockEventFetcher.startFetch()
        }
        if(this.eventFilter == undefined){
            this.eventFilter = new EventFilter(this)
        }
        
        this.eventFilter.startFilter(filter_info, callback)

        console.groupEnd()

        this.status_watcher.push(statusInfo)
    }

    update_height = async (height) => {
        // console.log('update_height:', height)
        this.status_block_height = height
        await this.redis.set(`${CACHE_KEY_EVENT_HEIGHT}_${this.evm_config.system_chain_id}`, height)
    }

    getStatus = async () => {
        return {
            block_height: this.status_block_height,
            watcher: this.status_watcher
        }
    }
}

module.exports = Monitor