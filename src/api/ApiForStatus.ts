import Router from "@koa/router";
import { EvmConfig, KoaCtx } from "../interface/interface";
import { MonitorManager } from "../monitor/MonitorManager";
const Table = require('tty-table')
import * as _ from "lodash";
export class ApiForStatus {

  linkRouter(router: Router, confit: EvmConfig) {
    const header = [
      {
        value: "baseInfo",
        align: "left",
        formatter: function (value: any) {
          if (value == undefined) {
            return "----"
          }
          return value;
        }
      },
      {
        value: "task",
        align: "left",
        formatter: function (value: any) {
          if (value == undefined) {
            return "----"
          }
          return value;
        }
      },
      {
        value: "fetchersStatus",
        align: "left",
        width: 20,
        formatter: function (value: any) {
          if (value == undefined) {
            return "----"
          }
          if (value == "--") {
            return "--"
          }
          let str = ``
          const list: any[] = JSON.parse(value)
          list.map(item => {
            str = str + `\n\nT=>${item.lastFetchTime}\n StartBlock:[${item.start}]\nEndBlock:[${item.start}]`
          })
          return str
        }
      },
      {
        value: "filters",
        align: "left",
        width: 30,
        formatter: function (value: any) {
          if (value == undefined) {
            return "----"
          }
          return value;
        }
      }, {
        value: "filterStatus",
        align: "left",
        width: 20,
        formatter: function (value: any) {
          if (value == undefined) {
            return "----"
          }
          if (value == "--") {
            return "--"
          }
          const result = JSON.parse(value)
          let blockNumber = 0
          if (result.lastData.length > 0 && _.isArray(result.lastData)) {
            blockNumber = parseInt(
              result.lastData[result.lastData.length - 1].blockNumber,
              16
            )
          }
          return `lastTime=>${result.lastTime}\nlastBlock=>${blockNumber}`
        }
      }
    ]
    router.get("/status", async (ctx: KoaCtx) => {
      const result = MonitorManager.getInst().getMoniterStatus();
      const statsTable: any[] = []
      for (let i = 0; i < result.length; i++) {
        const m = result[i].monitor
        const s = result[i].status
        statsTable.push({
          "id": m.id,
          "baseInfo": (() => {
            let baseStr = ``;
            baseStr = baseStr + `fetchBlockRunning:${m.fetchBlockRunning}\n`;
            const blockHeight = (() => {
              if (typeof m.blockHeight == "undefined") {
                return "----"
              }
              return m.blockHeight
            })();
            const realBlockHeight = (() => {
              if (typeof m.realBlockHeight == "undefined") {
                return "----"
              }
              return m.realBlockHeight
            })();
            const modeHistory = m.modeHistory == false ? "No" : "Yes";
            baseStr = baseStr + `blockHeight:${blockHeight}\n`;
            baseStr = baseStr + `realBlockHeight:${realBlockHeight}\n`;
            baseStr = baseStr + `modeHistory:${modeHistory}\n`;
            let fetcherSize: number = 0;
            if (!m.blockEventFetcher) {
              fetcherSize = 0
            } else {
              fetcherSize = m.blockEventFetcher.getFetcher().length;
            }
            baseStr = baseStr + `fetcherSize:${fetcherSize}\n`
            const dispatchTime = s.dispatchStatus.lastTime;
            baseStr = baseStr + `dispatchTime:${dispatchTime}\n`
            const heightWatcherLength = m.heightWatchers.length;
            baseStr = baseStr + `heightWatcher:${heightWatcherLength}`
            return baseStr

          })(),
          "task": (() => {
            if (m.blockFetchTaskList != undefined && _.isArray(m.blockFetchTaskList)) {
              let taskStr = ""
              const viewSize = m.blockFetchTaskList.length > 5 ? 5 : m.blockFetchTaskList.length
              if (viewSize <= 0) {
                return "Empty"
              }
              for (let i = 0; i < viewSize; i++) {
                taskStr = taskStr + `Start:${m.blockFetchTaskList[i].block_start}\n`
                taskStr = taskStr + `End:${m.blockFetchTaskList[i].block_end}\n\n\n`
              }
              if (viewSize > 5) {
                taskStr = taskStr + `...`
              }
              return taskStr
            } else {
              return "--"
            }
          })(),
          "fetchersStatus": (() => {
            if (!m.blockEventFetcher) {
              return "--"
            }
            const fetcherStatus: any[] = [];
            for (let i = 0; i < m.blockEventFetcher.getFetcher().length; i++) {
              fetcherStatus.push(m.blockEventFetcher.getFetcher()[i].fetchStatus)
            }
            return JSON.stringify(fetcherStatus)

          })(),
          "filters": (() => {
            let statusStr = ``
            for (const i in s.filters) {
              const filter = s.filters[i];
              statusStr = statusStr + `${filter.filter_info.event_data["name"]}\n${JSON.stringify(filter.statusInfo)}` + `\n\n`
            }
            return statusStr
          })(),
          "filterStatus": (() => {
            return JSON.stringify(s.filterStatus)
          })()
        })
      }
      console.log(Table(header, statsTable).render())
      ctx.body = {
        code: 0,
        message: "ok",
        statsTable
      }
      // console.log(result)
    })
    router.post("/statusHeight", async (ctx: KoaCtx) => {
      ctx.body = "ok";
    })
  }
}