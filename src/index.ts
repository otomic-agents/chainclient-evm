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

// close db in this
import existSafe, { ExistTask } from "./serverUtils/ExistSafe";
existSafe({} as ExistTask);

// catch error and alert
import ErrorAlert from "./serverUtils/ErrorAlert";
new ErrorAlert();
import ChainClientEVM from "./server";
const server = new ChainClientEVM();
server.start();
