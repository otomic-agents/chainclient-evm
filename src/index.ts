if (process.env["EASY_MONITOR"] == "true") {
  require('xprofiler').start();
  const xtransit = require('xtransit');
  const config = {
    server: process.env["EASY_MONITOR_SERVER"],
    appId: parseInt(process.env["EASY_MONITOR_APP_ID"]),
    appSecret: process.env["EASY_MONITOR_SECRET"],
  };
  xtransit.start(config);
}
const path = require("path")
import { Koatty, Bootstrap, ComponentScan, ConfigurationScan } from "koatty";
if (process.env["PROJECT_EXPANSION"] == "true") {
  @Bootstrap(
    (app: any) => {
      process.env.UV_THREADPOOL_SIZE = "128";
    }
  )
  @ComponentScan(path.join(__dirname, "../Koatty/Otmoic/"))
  @ConfigurationScan(path.join(__dirname, "../Koatty/Config/"))
  class App extends Koatty {
    public init() {
      this.appDebug = true;
      this.router = {
        options: {},
        router: {},
        SetRouter: (name: string, impl?: any) => () => {
        },

        LoadRouter: async (app: Koatty, list: any[]) => {
        },
        ListRouter: () => {
          const list: Map<string, any> = new Map();
          return list;
        }
      }
    }
    public listen() {
      // console.log("rewrite listen")
    }
  }
}

// close db in this
import existSafe, { ExistTask } from "./serverUtils/ExistSafe";
existSafe({} as ExistTask);

// catch error and alert
import ErrorAlert from "./serverUtils/ErrorAlert";
new ErrorAlert();
import ChainClientEVM from "./server";
import { TransactionHelper } from "./utils/transactionHelper";
import { any } from "async";
const server = new ChainClientEVM();
server.start();
