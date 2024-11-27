import { Logger, ILogObj } from "tslog";
import * as _ from "lodash";
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const dayjs = require("dayjs");
dayjs.extend(utc);
dayjs.extend(timezone);
import copy from 'fast-copy';
import { idLogger } from "./IdLog";
const log = idLogger
export { log as SystemOut };