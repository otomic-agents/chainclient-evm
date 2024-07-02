import Monitor from "./Monitor";
import { BlockFetchTask, EvmRpcClient } from "../interface/interface";
import { ethers } from "ethers";

const get_events = async (
  evmRpcClient: EvmRpcClient,
  from: string,
  to: string,
  callback: Function
) => {
  evmRpcClient
    .get()
    .request(
      {
        // jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [{ fromBlock: from, toBlock: to }],
        // id: 0,
      },
      8 * 1000
    )
    .then((resp) => {
      callback(null, resp);
    })
    .catch(async (error: Error) => {
      console.error("get_events error");
      console.error("from:", from);
      console.error("to:", to);
      console.error(error);
      if (error.message.indexOf("limit exceeded")) {
        await evmRpcClient.saveBlackTemporary();
      } else {
        await evmRpcClient.saveBlack();
      }

      callback(error, null);
    });
};

const startFetchEvent = (
  evmRpcClient: EvmRpcClient,
  blockFetchTaskList: BlockFetchTask[],
  monitor: Monitor
) => {
  let createEventFetcher = () => {
    console.log("create event fetcher");
    let run = async () => {
      let task: BlockFetchTask | undefined = undefined;
      for (let i = 0; i < blockFetchTaskList.length; i++) {
        if (blockFetchTaskList[i].step == 1) {
          task = blockFetchTaskList[i];
          break;
        }
      }

      if (task == undefined || monitor.restarting) {
        setTimeout(() => run(), 1000);
        return;
      }
      task.step = 2;

      console.log("fetcher task", task.block_start, task.block_end);

      await get_events(
        evmRpcClient,
        `0x${task.block_start.toString(16)}`,
        `0x${task.block_end.toString(16)}`,
        (err: Error, result: any) => {
          if (task == undefined) {
            throw new Error("state error, fetch task gone");
          }

          if (!err) {
            // console.log('get_events result')
            // console.log(result)
            task.event_data = result;
            task.step = 3;
            setTimeout(run, 1);
          } else {
            task.step = 1;
            setTimeout(run, 1);

            console.log(err);
            console.log(result);
          }
        }
      );
    };

    return {
      run,
    };
  };

  let fetchers: any[] = [];
  while (fetchers.length < 1) {
    let fetcher = createEventFetcher();
    fetcher.run();
    fetchers.push(fetcher);
  }
};

export default class BlockEventFetcher {
  monitor: Monitor;
  historyMode: boolean = false;
  historyModeEndBlock: number = 0;

  constructor(
    _monitor: Monitor,
    historyMode: boolean,
    historyModeEndBlock: number | undefined
  ) {
    this.monitor = _monitor;
    this.historyMode = historyMode;
    if (this.historyMode && historyModeEndBlock != undefined) {
      this.historyModeEndBlock = historyModeEndBlock;
    }
  }

  startFetch = async () => {
    if (this.monitor.fetchBlockRunning == true) {
      throw new Error("task fetch block exist, but start new one");
    }
    this.monitor.fetchBlockRunning = true;
    console.log("startFetch");


    if (this.monitor.taskBlockEventNow == undefined) {
      if (this.monitor.evmConfig == undefined)
        throw new Error("evmConfig not found");

      this.monitor.taskBlockEventNow = Number(
        this.monitor.evmConfig.start_block as string
      );
    }
    console.log("taskBlockEventNow:", this.monitor.taskBlockEventNow);

    if (this.monitor.blockFetchTaskList == undefined) {
      this.monitor.blockFetchTaskList = [];
    }

    let blockFetchTaskList = this.monitor.blockFetchTaskList;

    let self = this;

    console.log("create dispatcher");
    let dispatch = async () => {
      //check task number
      let task_number = 0;
      blockFetchTaskList.forEach((element) => {
        if (element.step != 3) task_number++;
      });
      console.log("task queue length", task_number);
      if (task_number < 10) {
        //fetch height
        await self.blockHeight((err: Error, result: any) => {
          if (!err) {
            if (self.historyMode) {
              self.monitor.blockHeight = result;
            } else {
              self.monitor.realBlockHeight = parseInt(result, 16);
              self.monitor.blockHeight = self.monitor.realBlockHeight - 6; //prevent chasing uncles
            }
          }
        });

        if (self.monitor.taskBlockEventNow == undefined)
          throw new Error(
            "block event fetcher state error: monitor.taskBlockEventNow undefined"
          );
        if (self.monitor.blockHeight == undefined)
          throw new Error(
            "block event fetcher state error: monitor.blockHeight undefined"
          );

        //create block object
        while (
          self.monitor.blockHeight > self.monitor.taskBlockEventNow &&
          task_number < 100
        ) {
          if (self.monitor.taskBlockEventNow == undefined)
            throw new Error(
              "block event fetcher state error: monitor.taskBlockEventNow undefined"
            );
          if (self.monitor.blockHeight == undefined)
            throw new Error(
              "block event fetcher state error: monitor.blockHeight undefined"
            );

          let block_start = self.monitor.taskBlockEventNow + 1;
          let block_end: number = (self.monitor.blockHeight - self.monitor.taskBlockEventNow) > 5 ? ( self.monitor.taskBlockEventNow + 5 ) : self.monitor.blockHeight;

          if (block_end == undefined)
            throw new Error(
              "block event fetcher state error: block_end undefined"
            );

          blockFetchTaskList.push({
            step: 1, // 1:wait 2:fetching 3:finished
            event_data: undefined,
            block_start,
            block_end,
          });
          self.monitor.taskBlockEventNow = block_end;
          task_number++;
        }
      }

      if (self.historyMode && blockFetchTaskList.length == 0) {
        console.log("task history finished");
      } else {
        setTimeout(dispatch, 5000);
      }
    };
    dispatch();

    if (this.monitor.evmRpcClient == undefined)
      throw new Error("evmRpcClient state error");

    startFetchEvent(
      this.monitor.evmRpcClient,
      blockFetchTaskList,
      this.monitor
    );
  };

  blockHeight = async (callback: Function) => {
    if (this.historyMode) {
      callback(null, this.historyModeEndBlock);
      return;
    }

    if (this.monitor.evmRpcClient == undefined)
      throw new Error("evmRpcClient state error");

    let result;
    try {
      // console.log('fetch height')
      result = await this.monitor.evmRpcClient.get().request(
        {
          // jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          // id: 0
        },
        0
      );
    } catch (error) {
      console.error(error);
      callback(error, null);
      return;
    }
    callback(null, result);
  };
}
