import Web3EthAbi from "web3-eth-abi";
import Monitor from "./Monitor";
import { DispatcherDataHolder, FilterInfo } from "../interface/interface";
import { SystemOut } from "../utils/systemOut";
import { throttledLog } from "../utils/comm";
const EVENT_PROCESS_LOG = new throttledLog(1000 * 60);
import * as async from "async";
function sleepms(time: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, time);
  });
}
export default class EventFilter {
  monitor: Monitor;
  dispatcherEventList: DispatcherDataHolder[];
  filterCount: number = 0;
  constructor(_monitor: Monitor) {
    this.monitor = _monitor;
    this.dispatcherEventList = [];

    const self = this;
    const dispatcher = async () => {
      if (self.monitor.blockFetchTaskList == undefined)
        throw new Error("blockFetchTaskList undefined");

      const blockFetchTaskList = self.monitor.blockFetchTaskList;
      while (blockFetchTaskList[0]?.step == 3) {
        const task = blockFetchTaskList.shift();

        self.dispatcherEventList.forEach((obj) => {
          if (task == undefined) {
            throw new Error("dispatcher error: blockFetchTaskList[0] gone");
          }
          obj.event_list.push(task);
        });
      }
    };
    setInterval(dispatcher, 3000);
    setInterval(() => {
      SystemOut.info("Current number of filters:", this.filterCount);
    }, 1000 * 60);
  }

  startFilter = async (filter_info: FilterInfo, callback: Function) => {
    this.filterCount++;
    const dispatcherDataHolder: DispatcherDataHolder = {
      filter_info,
      event_list: [],
    };
    this.dispatcherEventList.push(dispatcherDataHolder);

    const self = this;
    const status = {};
    const checkEvent = async (stop: Function) => {
      if (typeof this.monitor.onFilter() == "function") {
        this.monitor.onFilter();
      }
      const blockFetchTaskList = dispatcherDataHolder.event_list;
      EVENT_PROCESS_LOG.log(
        "CheckEvent still running",
        new Date().toISOString().replace(/T/, " ").substring(0, 19)
      );
      try {
        while (blockFetchTaskList[0]?.step == 3) {
          const task = blockFetchTaskList.shift();
          await new Promise(async (taskDone: Function) => {
            if (task == undefined) {
              throw new Error("dispatcher error: blockFetchTaskList[0] gone");
            }
            this.monitor.onFilterData(task.event_data);
            const events = task.event_data.filter((event: any) => {
              return event.topics[0] == filter_info.topic_string;
            });

            let finishedEvent = 0;
            const dataMap: Map<string, { tx: any; block: any }> = new Map();
            const downloadTasks: any[] = [];
            if (self.monitor.evmRpcClient == undefined) {
              throw new Error("evmRpcClient not found");
            }
            events.forEach((log: any) => {
              downloadTasks.push(
                new Promise((resolve, reject) => {
                  const downloadResult: { tx: any; block: any } = {
                    tx: null,
                    block: null,
                  };
                  async.series(
                    [
                      function getTransactionReceipt(cb) {
                        self.monitor.evmRpcClient
                          .get()
                          .request({
                            method: "eth_getTransactionReceipt",
                            params: [log.transactionHash],
                          })
                          .then((tx) => {
                            downloadResult.tx = tx;
                            cb(null, tx);
                          })
                          .catch((e) => {
                            cb(e, null);
                          });
                      },
                      function getBlockByNumber(cb) {
                        self.monitor.evmRpcClient
                          .get()
                          .request({
                            method: "eth_getBlockByNumber",
                            params: [downloadResult.tx.blockNumber, false],
                          })
                          .then((block: any) => {
                            downloadResult.block = block;
                            cb(null, block);
                          })
                          .catch((e) => {
                            cb(e, null);
                          });
                      },
                    ],
                    function done(err, result) {
                      if (!err) {
                        dataMap.set(log.transactionHash, {
                          tx: downloadResult.tx,
                          block: downloadResult.block,
                        });
                        resolve({
                          tx: downloadResult.tx,
                          block: downloadResult.block,
                        });
                      } else {
                        reject("download faild");
                      }
                    }
                  );
                })
              );
            });
            if (downloadTasks.length > 0) {
              SystemOut.debug(
                `down load event data: ${task.block_start},${task.block_end}`
              );
              try {
                await Promise.all(downloadTasks);
              } catch (error) {
                SystemOut.error(
                  "An error occurred while processing the promises:",
                  error
                );
                SystemOut.warn(
                  `retry process ${task.block_start}-${task.block_end}`
                );
                blockFetchTaskList.unshift(task);
                taskDone(true);
                return;
              }
            } else {
              // SystemOut.info("downLoad task count", downloadTasks.length);
            }
            events.forEach((log: any) => {
              const tx = dataMap.get(log.transactionHash).tx;
              const respBlock = dataMap.get(log.transactionHash).block;
              SystemOut.info("Time line");
              SystemOut.info("<-- tx");
              SystemOut.info(tx);

              const eventParse = Web3EthAbi.decodeLog(
                filter_info.event_data.inputs,
                log.data,
                log.topics.slice(1)
              );
              finishedEvent++;
              callback({
                event: log,
                tx,
                eventParse,
                block: respBlock,
              });
            });

            (async (task) => {
              try {
                await self.monitor.update_height(
                  task.block_end,
                  filter_info.filter_id
                );
              } catch (error) {
                SystemOut.error("update_height error:", error, task.event_data);
              } finally {
                taskDone(true);
                return;
              }
            })(task);
          });
        }
      } catch (e) {
        SystemOut.error(e);
      }
    };
    let stop = false;
    for (; ;) {
      if (stop) {
        setInterval(() => {
          SystemOut.info("filter loop is stoped .");
        }, 1000 * 10);
        break;
      }
      try {
        await checkEvent(() => {
          stop = true;
        });
      } catch (e) {
        SystemOut.error("process event error:", e);
      } finally {
        await sleepms(1000 * 3);
      }
    }
  };
}
