import { Logger, ILogObj } from "tslog";
import * as _ from "lodash";
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const dayjs = require("dayjs");
dayjs.extend(utc);
dayjs.extend(timezone);
import copy from 'fast-copy';
const log: Logger<ILogObj> = new Logger({ prettyLogTimeZone: "UTC" });
log.settings.minLevel = parseInt(_.get(process, "env.LOG_LEVEL", "3"))
import { timeout } from "async";
const axios = require('axios');

const headers = {
  'Content-Type': 'application/json',
  'Api-Key': process.env["NEW_RELIC_LICENSE_KEY"],
  'Accept': '*/*',
};

function logObjectComplexity(obj: any, depth = 0, width = 0) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }
  depth++;
  if (Array.isArray(obj)) {
    width += obj.length;
  } else {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        logObjectComplexity(obj[key], depth, width);
      }
    }
  }
  if (depth > 5 || width > 100) {
    console.log(`The object is complex. Depth: ${depth}, Width: ${width}.`);
    return false
  }
  return true
}
log.attachTransport((logObj) => {
  const canSendLog = logObjectComplexity(logObj)
  if (!canSendLog) {
    return;
  }
  const cloneObj = copy(logObj)
  if (process.env["LOG_DEBUG"] == "true") {
    const baseLogItem = {
      "timestamp": new Date().getTime(),
      // "viewtime": new Date(new Date().getTime()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    }
    Object.assign(baseLogItem, cloneObj)
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
        timeout: 2500
      }
    )
      .then((response: any) => {
        // console.log('Response from server:', response.data);
      })
      .catch((error: any) => {
        console.error('Error submitting data:', error.toString());
      });
  }
});
export { log as SystemOut };