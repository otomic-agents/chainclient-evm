import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import Router from '@koa/router'

import Redis, { RedisOptions } from "ioredis"
import { RequestManager, Client, HTTPTransport } from "@open-rpc/client-js"

import Config from './config/Config'

import ApiForLp from './api/ApiForLp'
import ApiForLpAdmin from './api/ApiForLpAdmin'
import ApiForRelay from './api/ApiForRelay'
import ApiSupport from './api/ApiSupport'
import { EvmConfig, EvmRpcClient } from './interface/interface'
import Monitor from './monitor/Monitor'
import Wallet from './wallet/Wallet'
import TransactionManager from './wallet/TransactionManager'
import StatusSyncer from './status/StatusSyncer'

export default class ChainClientEVM {
    
    router: Router | undefined
    redis: Redis | undefined

    monitor: Monitor | undefined
    wallet: Wallet | undefined
    transactionManager: TransactionManager | undefined
    syncer: StatusSyncer | undefined

    evmRpcClient: EvmRpcClient | undefined

    constructor () {

    }

    start = async () => {
        await this.initDB()

        await this.initEvmRpcClient()

        await this.initModule()

        await this.initRouter()

        await this.startServer()
    }

    initDB = async () => {
        console.log('initDB')
        let opt: RedisOptions = {
            host: Config.redis_config.host,
            port: parseInt(Config.redis_config.port as string),
            db: Config.redis_config.db,
            password: Config.redis_config.pwd
        }

        this.redis = new Redis(opt);
    }

    initEvmRpcClient = async () => {
        console.log('initEvmRpcClient')
        this.evmRpcClient = {

            /* Prevent blockage of subsequent program execution when frequency limiting,
            no response, etc. occur, and create a new connection for request each time */
            get : () => {
                let transport = new HTTPTransport(Config.evm_config.rpc_url as string,
                    {headers: {"Accept-Encoding": "gzip"}}
                );
                let requestManager = new RequestManager([transport]);
                let client = new Client(requestManager);
                return client
            }
        }
    }

    initModule = async () => {
        console.log('initModule')
        this.monitor = new Monitor()
        this.wallet = new Wallet()
        this.transactionManager = new TransactionManager()
        this.syncer = new StatusSyncer()
    }

    initRouter = async () => {
        console.log('initRouter')
        this.router = new Router();
        new ApiForRelay().linkRouter(this.router, Config.evm_config as EvmConfig)
        new ApiForLp().linkRouter(this.router, Config.evm_config as EvmConfig)
        new ApiForLpAdmin().linkRouter(this.router, Config.evm_config as EvmConfig)
        new ApiSupport().linkRouter(this.router, Config.evm_config as EvmConfig)
    }

    startServer = async () => {

        if (this.router == undefined) {
            throw new Error('start server error: router undefined')
        }

        const app = new Koa();
        app.context.monitor = this.monitor
        app.context.wallet = this.wallet
        app.context.transactionManager = this.transactionManager
        app.context.config = Config
        app.context.rpcClient = this.evmRpcClient

        app.use(bodyParser({}));
        app.use(this.router.routes()).use(this.router.allowedMethods());
        app.listen(Config.server_config.port);

        console.log(`server start, listen: ${Config.server_config.port}`)
        console.log('routers')
        this.router.stack.forEach((route) => {
            console.log(route.methods.join(', '), route.path);
        });
    }
}