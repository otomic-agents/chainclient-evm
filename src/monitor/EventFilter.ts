import Web3EthAbi from "web3-eth-abi";
import Monitor from "./Monitor";
import { DispatcherDataHolder, FilterInfo } from "../interface/interface";
import sleep from "../serverUtils/Sleeper";

export default class EventFilter {
  monitor: Monitor;
  dispatcherEventList: DispatcherDataHolder[];

  constructor(_monitor: Monitor) {
    this.monitor = _monitor;
    this.dispatcherEventList = [];

    let self = this;
    const dispatcher = async () => {
      if (self.monitor.blockFetchTaskList == undefined)
        throw new Error("blockFetchTaskList undefined");

      let blockFetchTaskList = self.monitor.blockFetchTaskList;
      while (blockFetchTaskList[0]?.step == 3) {
        let task = blockFetchTaskList.shift();

        self.dispatcherEventList.forEach((obj) => {
          if (task == undefined) {
            throw new Error("dispatcher error: blockFetchTaskList[0] gone");
          }
          obj.event_list.push(task);
        });
      }
    };
    setInterval(dispatcher, 3000);
  }

  startFilter = async (filter_info: FilterInfo, callback: Function) => {
    const dispatcherDataHolder: DispatcherDataHolder = {
      filter_info,
      event_list: [],
    };
    this.dispatcherEventList.push(dispatcherDataHolder);

    let self = this;
    let checkEvent = async () => {
      let blockFetchTaskList = dispatcherDataHolder.event_list;
      while (blockFetchTaskList[0]?.step == 3) {
        let task = blockFetchTaskList.shift();

        if (task == undefined) {
          throw new Error("dispatcher error: blockFetchTaskList[0] gone");
        }

        let events = task.event_data.filter((event: any) => {
          // console.log(event.topics[0])
          // console.log(filter_info.topic_string)
          return event.topics[0] == filter_info.topic_string;
        });

        // console.log(task)
        // console.log('hit events')
        // console.log(events)

        let finishedEvent = 0;
        events.forEach(async (log: any) => {
          if (self.monitor.evmRpcClient == undefined)
            throw new Error("evmRpcClient not found");

          self.monitor.evmRpcClient
            .get()
            .request({
              // "jsonrpc": "2.0",
              method: "eth_getTransactionReceipt",
              params: [log.transactionHash],
              //  "id": 0
            })
            .then((resp) => {
              const tx = resp;
              console.log("--------------------> tx", tx);

              let eventParse = Web3EthAbi.decodeLog(
                filter_info.event_data.inputs,
                log.data,
                log.topics.slice(1)
              );

              self.monitor.evmRpcClient
                .get()
                .request({
                  method: "eth_getBlockByNumber",
                  params: [tx.blockNumber, false],
                })
                .then((respBlock) => {
                  callback({
                    event: log,
                    tx,
                    eventParse,
                    block: respBlock,
                  });
                  finishedEvent++;
                })
                .catch((errBlock) => {
                  console.log(
                    "call eth_getBlockByNumber error",
                    log.transactionHash
                  );
                  console.error(errBlock);
                });
            })
            .catch((error) => {
              console.log(
                "call eth_getTransactionReceipt error",
                log.transactionHash
              );
              console.error(error);
            });
        });

        while (finishedEvent < events.length) {
          await sleep(100);
        }

        // if(events.length > 0){
        //     await self.monitor.update_height(parseInt(events[events.length - 1].blockNumber, 16))
        // } else {
        try {
          await self.monitor.update_height(
            parseInt(
              task.event_data[task.event_data.length - 1].blockNumber,
              16
            )
          );
        } catch (error) {
          console.log("event_data length error");
        }

        // }
      }

      setTimeout(checkEvent, 1000 * 3);
    };
    checkEvent();
  };
}
