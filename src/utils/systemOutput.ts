import { Logger, ILogObj } from "tslog";

const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const dayjs = require("dayjs");
dayjs.extend(utc);
dayjs.extend(timezone);
const log: Logger<ILogObj> = new Logger({ prettyLogTimeZone: "UTC" });
import * as _ from "lodash";
import { timeout } from "async";
const axios = require('axios');

const headers = {
  'Content-Type': 'application/json',
  'Api-Key': process.env["NEW_RELIC_LICENSE_KEY"],
  'Accept': '*/*',
};


log.attachTransport((logObj) => {
  if (process.env["LOG_DEBUG"] == "true") {
    const baseLogItem = {
      "timestamp": new Date().getTime(),
      "viewtime": new Date(new Date().getTime()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    }
    Object.assign(baseLogItem, logObj)
    const logsData = [
      {
        "common": {
          "attributes": {
            "logtype": "accesslogs",
            "service": "chain-client-evm",
          }
        },
        "logs": [
          baseLogItem
        ]
      }
    ];
    axios.post(
      process.env["LOG_DEBUG_URL"],
      JSON.stringify(logsData),
      {
        headers,
        maxContentLength: Infinity,
        timeout: 1500
      }
    )
      .then((response: any) => {
        // console.log('Response from server:', response.data);
      })
      .catch((error: any) => {
        console.error('Error submitting data:', error);
      });
  }
});
export { log as systemOutput };