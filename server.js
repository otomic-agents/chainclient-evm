//import
const Koa = require("koa");
const BodyParser = require('koa-bodyparser');
const { RequestManager, Client, HTTPTransport, HTTPTransportOptions } = require("@open-rpc/client-js");

//config
const Config = require('./config/Config.js');

//module
const Controller = require('./controllers.js');

//db
const Redis = require('ioredis');

//monitor
const Monitor = require('./monitor/Monitor')
const {watchTransferOut, watchTransferIn, watchConfirm, watchRefund} = require('./api/Utils')

//wallet
const Wallet = require('./wallet/Wallet')
const TransactionManager = require('./wallet/TransactionManager')

//status syncer
const StatusSyncer = require('./status/Status')


class Server {
    constructor(){
        this.init()
    }
    init = async () => {
        this.monitor = new Monitor()
        this.wallet = new Wallet()
        this.transactionManager = new TransactionManager()
        this.syncer = new StatusSyncer()
        console.log('config:')
        console.log(Config)

        await this.initRedis(Config.redis_config)
        await this.initEvmRpcClient(Config.evm_config)
        this.monitor.setConfig(this.redis, this.evmRpcClient, Config.evm_config)
        this.wallet.setConfig(this.redis, this.evmRpcClient, Config.evm_config)
        this.transactionManager.setConfig(this.redis, this.wallet, this.evmRpcClient, Config.evm_config)
        
        await this.setDefaultWatcher()
        this.startStatusSyncer()
    }
    setDefaultWatcher = async () => {
        if (Config.relay_server_url.on_transfer_out != undefined && Config.relay_server_url.on_transfer_out != "") {
            watchTransferOut(this.monitor, Config.relay_server_url.on_transfer_out)
        }
        if (Config.relay_server_url.on_transfer_in != undefined && Config.relay_server_url.on_transfer_in != "") {
            watchTransferIn(this.monitor, Config.relay_server_url.on_transfer_in)
        }
        if (Config.relay_server_url.on_confirm != undefined && Config.relay_server_url.on_confirm != "") {
            watchConfirm(this.monitor, Config.relay_server_url.on_confirm)
        }
        if (Config.relay_server_url.on_refunded != undefined && Config.relay_server_url.on_refunded != "") {
            watchRefund(this.monitor, Config.relay_server_url.on_refunded)
        }
    }
    startStatusSyncer = async () => {
        let statusRedis = new Redis({
            host: Config.redis_config.host,
            port: Config.redis_config.port,
            prefix: Config.redis_config.prefix,
            db: Config.redis_config.statusDB,
            password: Config.redis_config.pwd
        });

        await this.syncer.setTarget(this.monitor, this.wallet, this.transactionManager)
        await this.syncer.setRedis(statusRedis, Config.syncer_config)
        this.syncer.start()
    }
    initRedis = async (redis_config) => {
        this.redis = new Redis({
            host: redis_config.host,
            port: redis_config.port,
            prefix: redis_config.prefix,
            db: redis_config.db,
            password: redis_config.pwd
        });
    }
    initEvmRpcClient = async (evm_config) => {
        this.evmRpcClient = {

            /* Prevent blockage of subsequent program execution when frequency limiting,
            no response, etc. occur, and create a new connection for request each time */
            get : () => {
                // console.log('rpc_url:', evm_config.rpc_url)
                let transport = new HTTPTransport(evm_config.rpc_url,
                    {headers: {"Accept-Encoding": "gzip"}}
                );
                let requestManager = new RequestManager([transport]);
                let client = new Client(requestManager);
                return client
            }
        }
    }
    start = () => {
        this.startServer()
    }
    startServer = async () => {
        const app = new Koa();
        app.context.monitor = this.monitor
        app.context.wallet = this.wallet
        app.context.transactionManager = this.transactionManager
        app.context.config = Config

        app.use(BodyParser());
        app.use(Controller('./api'));

        app.listen(Config.server_config.port)
        

    }
}

let server = new Server()
server.start()
