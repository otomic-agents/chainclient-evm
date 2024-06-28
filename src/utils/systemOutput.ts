import { Logger, ILogObj } from "tslog";

const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const dayjs = require("dayjs");
dayjs.extend(utc);
dayjs.extend(timezone);
const log: Logger<ILogObj> = new Logger({ prettyLogTimeZone: "UTC" });
import * as _ from "lodash";

export { log as systemOutput };