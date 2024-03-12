import Monitor from "../monitor/Monitor"
import Wallet from "../wallet/Wallet"
import TransactionManager from "../wallet/TransactionManager"
import { Redis } from "ioredis"
import { SyncerConfig } from "../interface/interface"

export default class StatusSyncer{
    monitor: Monitor | undefined
    wallet: Wallet | undefined
    transactionManager: TransactionManager | undefined

    redis: Redis | undefined
    config: SyncerConfig | undefined

    constructor(){}
    setTarget = async (monitor: Monitor, wallet: Wallet, transactionManager: TransactionManager) => {
        this.monitor = monitor
        this.wallet = wallet
        this.transactionManager = transactionManager
    }
    setRedis = async (redis: Redis, config: SyncerConfig) => {
        this.redis = redis
        this.config = config
        // statusRedis.hset(`CHAIN_CLIENT_STATUS`, Config.evm_config.system_chain_id, new Date().getTime());
    }

    start = async () => {

        setInterval(async () => {
            let monitorInfo = await this.getMonitorStatus()
            let walletInfo = await this.getWalletStatus()
            let transactionManagerInfo = await this.getTransactionManagerStatus()

            if (this.config == undefined) throw new Error("state error config undefined");
            if (this.redis == undefined) throw new Error("state error redis undefined");

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
        if (this.monitor == undefined) throw new Error("state error monitor undefined");

        return await this.monitor.getStatus()
    }

    getWalletStatus = async () => {
        if (this.wallet == undefined) throw new Error("state error wallet undefined");

        return await this.wallet.getStatus()
    }

    getTransactionManagerStatus = async () => {
        if (this.transactionManager == undefined) throw new Error("state error transactionManager undefined");

        return await this.transactionManager.getStatus()
    }

}