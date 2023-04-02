
class StatusSyncer {
    constructor(){}
    setTarget = async (monitor, wallet, transactionManager) => {
        this.monitor = monitor
        this.wallet = wallet
        this.transactionManager = transactionManager
    }
    setRedis = async (redis, config) => {
        this.redis = redis
        this.config = config
        // statusRedis.hset(`CHAIN_CLIENT_STATUS`, Config.evm_config.system_chain_id, new Date().getTime());
    }

    start = async () => {

        setInterval(async () => {
            let monitorInfo = await this.getMonitorStatus()
            let walletInfo = await this.getWalletStatus()
            let transactionManagerInfo = await this.getTransactionManagerStatus()

            if(this.config.status_key != undefined && this.config.status_key != ""){
                this.redis.set(this.config.status_key, JSON.stringify({
                    monitorInfo,
                    walletInfo,
                    transactionManagerInfo,
                    timestamp: new Date().toISOString()
                }) )
            }

        }, 10000);
    }

    getMonitorStatus = async () => {
        return await this.monitor.getStatus()
    }

    getWalletStatus = async () => {
        return await this.wallet.getStatus()
    }

    getTransactionManagerStatus = async () => {
        return await this.transactionManager.getStatus()
    }

}

module.exports = StatusSyncer

