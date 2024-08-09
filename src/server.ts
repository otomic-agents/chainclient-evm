import Koa from "koa";
import bodyParser from "koa-bodyparser";
import koaLogger from 'koa-logger';
import Router from "@koa/router";
import Redis, { RedisOptions } from "ioredis";
import { RequestManager, Client, HTTPTransport } from "@open-rpc/client-js";

import Config from "./config/Config";

import ApiForLp from "./api/ApiForLp";
import ApiForLpAdmin from "./api/ApiForLpAdmin";
import ApiForRelay from "./api/ApiForRelay";
import ApiSupport from "./api/ApiSupport";
import { EvmConfig, EvmRpcClient } from "./interface/interface";
import Monitor from "./monitor/Monitor";
import Wallet from "./wallet/Wallet";
import TransactionManager from "./wallet/TransactionManager";
import StatusSyncer from "./status/StatusSyncer";
import {
    watchConfirmIn,
    watchConfirmOut,
    watchRefundOut,
    watchTransferIn,
    watchTransferOut
} from "./serverUtils/WatcherFactory";
import RPCGeter from "./serverUtils/RPCGeter";
import { UniqueIDGenerator } from "./utils/comm";
import { systemOutput } from "./utils/systemOutput";
import { HttpRpcClient } from "./serverUtils/HttpRpcClient";

export default class ChainClientEVM {
    router: Router | undefined;
    redis: Redis | undefined;

    monitor: Monitor | undefined;
    wallet: Wallet | undefined;
    transactionManager: TransactionManager | undefined;
    syncer: StatusSyncer | undefined;

    evmRpcClient: EvmRpcClient | undefined;
    rpcUrl: string = Config.evm_config.rpc_url;

    rpcGeter: RPCGeter = new RPCGeter();

    constructor() { }
    private prepareDb() {
        return new Promise((resolve, reject) => {
            let opt: RedisOptions = {
                host: Config.redis_config.host,
                port: parseInt(Config.redis_config.port as string),
                db: Config.redis_config.db,
                password: Config.redis_config.pwd,
                retryStrategy: () => {
                    const delay = 3000;
                    return delay;
                }
            };

            this.redis = new Redis(opt);
            this.redis.on("reconnecting", () => {
                systemOutput.debug("Connecting to the database")
            })
            this.redis.on("connect", () => {
                resolve(true)
            })
        })

    }
    start = async () => {
        let timeout = new Promise(function (resolve, reject) {
            setTimeout(function () {
                reject('connection redis timeout');
            }, 1000 * 60);
        });
        try {
            await Promise.race([this.prepareDb(), timeout])
        } catch (e) {
            if (e.toString().includes("connection redis timeout")) {
                systemOutput.error("connection redis timeout")
                process.exit()
            } else {
                systemOutput.error("connection redis timeout")
                process.exit()
            }
        }

        await this.initDB();

        await this.initEvmRpcClient();

        await this.initModule();

        if (Config.server_config.auto_start == "true") {
            await this.initDefaultWatcher();
        }

        if (Config.server_config.relay_wallet == "true") {
            await this.initRelayWallet();
        }

        await this.initRouter();

        await this.startServer();
    };

    initDB = async () => {
        console.log("initDB");
        let opt: RedisOptions = {
            host: Config.redis_config.host,
            port: parseInt(Config.redis_config.port as string),
            db: Config.redis_config.db,
            password: Config.redis_config.pwd,
            retryStrategy: () => {
                const delay = 3000;
                return delay;
            }
        };

        this.redis = new Redis(opt);
        setInterval(() => {
            this.redis.ping()
            // systemOutput.debug("send redis ping")
        }, 1000 * 10)
    };

    changeUrl = async () => {
        if (process.env.AUTO_RPC == "true") {
            const availableUrl = await this.rpcGeter.chooseOne(parseInt(Config.evm_config.chain_id));
            this.rpcUrl = availableUrl;
        }

        if (this.rpcUrl == undefined) {
            this.rpcUrl = Config.evm_config.rpc_url_preset;
        }
        Config.evm_config.rpc_url = this.rpcUrl;
    };

    initEvmRpcClient = async () => {
        this.evmRpcClient = { /* Prevent blockage of subsequent program execution when frequency limiting,
            no response, etc. occur, and create a new connection for request each time */
            get: (): Client => { // systemOutput.debug("rpc url is: ",this.rpcUrl)
                let client: any = new HttpRpcClient(this.rpcUrl)

                return client;
            },

            saveBlack: async () => {
                this.rpcGeter.addBlack(this.rpcUrl);
                this.changeUrl();
            },

            saveBlackTemporary: async () => {
                this.rpcGeter.addBlack(this.rpcUrl);
                this.changeUrl();

                let thisUrl = `${this.rpcUrl
                    }`;
                setTimeout(() => {
                    this.rpcGeter.blackList = this.rpcGeter.blackList.filter((item) => item != thisUrl);
                    console.log("this.rpcGeter.blackList", this.rpcGeter.blackList);
                }, 10 * 60 * 1000);
            }
        };
    };

    initModule = async () => {
        console.log("initModule");
        this.monitor = new Monitor();
        this.wallet = new Wallet();
        this.transactionManager = new TransactionManager();
        this.syncer = new StatusSyncer();
        await this.changeUrl();

        await this.monitor.setConfigModeChase(this.redis, this.evmRpcClient, Config.evm_config);
        await this.wallet.setConfig(this.redis, this.evmRpcClient, Config.evm_config);
        await this.transactionManager.setConfig(this.redis, this.wallet, this.evmRpcClient, Config.evm_config);

        let opt: RedisOptions = {
            host: Config.redis_config.host,
            port: parseInt(Config.redis_config.port as string),
            db: Config.redis_config.statusDB,
            password: Config.redis_config.pwd,
            retryStrategy: () => {
                const delay = 3000;
                return delay;
            }
        };
        let statusRedis = new Redis(opt);
        setInterval(() => {
            statusRedis.ping()
            // systemOutput.debug("send redis ping")
        }, 1000 * 10)

        await this.syncer.setTarget(this.monitor, this.wallet, this.transactionManager);
        await this.syncer.setRedis(statusRedis, Config.syncer_config);
        this.syncer.start();
    };

    initDefaultWatcher = async () => {
        if (Config.relay_server_url.on_transfer_out != undefined && Config.relay_server_url.on_transfer_out != "") {
            watchTransferOut(this.monitor, Config.relay_server_url.on_transfer_out, Config.evm_config, false, undefined);
        }
        if (Config.relay_server_url.on_confirm_in != undefined && Config.relay_server_url.on_confirm_in != "") {
            systemOutput.debug("watch confirm in ", Config.relay_server_url.on_confirm_in, "");
            watchConfirmIn(this.monitor, Config.relay_server_url.on_confirm_in, Config.evm_config, false, undefined)
        }
        if (Config.relay_server_url.on_confirm != undefined && Config.relay_server_url.on_confirm != "") {
            watchConfirmOut(this.monitor, Config.relay_server_url.on_confirm, Config.evm_config, false, undefined);
        }
        if (Config.relay_server_url.on_refunded != undefined && Config.relay_server_url.on_refunded != "") {
            watchRefundOut(this.monitor, Config.relay_server_url.on_refunded, Config.evm_config, false, undefined);
        }
    };

    initRelayWallet = async () => {
        await this.wallet.updateWallet(Config.relay_wallet);
        await this.wallet.getWalletInfo();
    };

    initRouter = async () => {
        console.log("initRouter");
        this.router = new Router();
        new ApiForRelay().linkRouter(this.router, Config.evm_config as EvmConfig);
        new ApiForLp().linkRouter(this.router, Config.evm_config as EvmConfig);
        new ApiForLpAdmin().linkRouter(this.router, Config.evm_config as EvmConfig);
        new ApiSupport().linkRouter(this.router, Config.evm_config as EvmConfig);
    };

    startServer = async () => {
        if (this.router == undefined) {
            throw new Error("start server error: router undefined");
        }

        const app = new Koa();
        app.context.monitor = this.monitor;
        app.context.wallet = this.wallet;
        app.context.transactionManager = this.transactionManager;
        app.context.config = Config;
        app.context.rpcClient = this.evmRpcClient;

        app.use(bodyParser({}));
        app.use(koaLogger());
        app.use(this.router.routes()).use(this.router.allowedMethods());
        app.listen(Config.server_config.port);

        console.log(`server start, listen: ${Config.server_config.port}`);
        console.log("routers");
        this.router.stack.forEach((route) => {
            console.log(route.methods.join(", "), route.path);
        });
    };
}
