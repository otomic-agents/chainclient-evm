import Monitor from "./Monitor";
import { BlockFetchTask, EvmRpcClient } from "../interface/interface";
import { SystemOut } from "../utils/systemOut";
import * as _ from "lodash";
const get_events = async (evmRpcClient: EvmRpcClient, from: string, to: string, callback: Function) => {
    evmRpcClient.get().request({ // jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [
            {
                fromBlock: from,
                toBlock: to
            }
        ],
        // id: 0,
    }, 8 * 1000).then((resp) => {
        callback(null, resp);
    }).catch(async (error: Error) => {
        console.error("get_events error", error, from, to);
        try {
            if (error.message.indexOf("limit exceeded")) {
                await evmRpcClient.saveBlackTemporary();
            } else {
                await evmRpcClient.saveBlack();
            }
        } catch (e) {
            SystemOut.error(e);
        } finally {
            callback(error, null);
        }
    });
};

const startFetchEvent = (evmRpcClient: EvmRpcClient, blockFetchTaskList: BlockFetchTask[], monitor: Monitor) => {
    const createEventFetcher = () => {
        SystemOut.info("create event fetcher");
        const fetchStatus = {
            lastFetchTime: 0,
            start: 0,
            end: 0,
            download: false,
        }
        const run = async () => {
            fetchStatus.lastFetchTime = new Date().getTime();
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
            fetchStatus.download = true;
            fetchStatus.start = task.block_start
            fetchStatus.end = task.block_end
            task.step = 2;
            SystemOut.debug("Fetcher task", "start", task.block_start, "end", task.block_end);

            await get_events(evmRpcClient, `0x${task.block_start.toString(16)
                }`, `0x${task.block_end.toString(16)
                }`, (err: Error, result: any) => {
                    if (task == undefined) {
                        throw new Error("state error, fetch task gone");
                    }

                    if (!err) {
                        // console.log('get_events result')
                        // console.log(result)
                        task.event_data = result;
                        if (!result) {
                            SystemOut.warn("result is null", result);
                        }
                        task.step = 3;

                        setTimeout(run, 10);
                    } else {
                        task.step = 1;
                        setTimeout(run, 10);

                        console.log(err);
                        console.log(result);
                    }
                });
        };

        return { run, fetchStatus };
    };

    const fetchers: any[] = [];
    while (fetchers.length < 1) {
        const fetcher = createEventFetcher();
        fetcher.run();
        fetchers.push(fetcher);
    }
    return fetchers
};

export default class BlockEventFetcher {
    private fetchers: any[];
    monitor: Monitor;
    historyMode: boolean = false;
    historyModeEndBlock: number = 0;
    public getFetcher() {
        return this.fetchers
    }
    public constructor(_monitor: Monitor, historyMode: boolean, historyModeEndBlock: number | undefined) {
        this.monitor = _monitor;
        this.historyMode = historyMode;
        if (this.historyMode && historyModeEndBlock != undefined) {
            this.historyModeEndBlock = historyModeEndBlock;
        }
    }
    private monitorTaskQueue() {
        setInterval(() => {
            const task_number = this.getRuningTaskNumber();
            // systemOutput.debug("Queue Status:");
            // console.table({ "Task Queue Length": task_number });
        }, 1000 * 20);
    }
    private getRuningTaskNumber(): number {
        let task_number = 0;
        this.monitor.blockFetchTaskList.forEach((element) => {
            if (element.step != 3)
                task_number++;

        });
        return task_number;
    }
    private async startDispatch(blockFetchTaskList: BlockFetchTask[]) {
        const self = this;
        const next = () => {
            setTimeout(() => {
                dispatch();
            }, 5000);
        };
        SystemOut.info("create dispatcher");
        const dispatch = async () => { // check task number
            this.monitor.onDispatch();
            let task_number = this.getRuningTaskNumber();
            if (task_number > 10) {
                next();
                return;
            }
            // create block object
            SystemOut.debug("task dispatch ", self.monitor.blockHeight > self.monitor.taskBlockEventNow, self.monitor.blockHeight, self.monitor.taskBlockEventNow);
            while (self.monitor.blockHeight > self.monitor.taskBlockEventNow && task_number < 100) {
                const block_start = self.monitor.taskBlockEventNow + 1;
                const block_end: number = self.monitor.blockHeight - self.monitor.taskBlockEventNow > 5 ? self.monitor.taskBlockEventNow + 5 : self.monitor.blockHeight;
                blockFetchTaskList.push({
                    step: 1, // 1:wait 2:fetching 3:finished
                    event_data: undefined,
                    block_start,
                    block_end
                });
                self.monitor.taskBlockEventNow = block_end;
                task_number++;
            }
            if (self.historyMode && blockFetchTaskList.length == 0) {
                this.monitor.onEnd();
                console.log("task history finished");
                return;
            }
            this.monitor.onDispatchTask(blockFetchTaskList)
            next();
        };
        dispatch();
    }

    private stopDispatch() {

    }
    private async monitorLatestHeight() {
        try {
            const height = await this.getAndSetLatestHeight();
            SystemOut.debug(`Loop update height sucessed`, `${height}`);
        } catch (e) {
            SystemOut.error("monitorlatestHeight error:", e);
        } finally {
            setTimeout(() => {
                this.monitorLatestHeight();
            }, 1000 * 5);
        }
    }
    public async startFetch() {
        if (this.monitor.fetchBlockRunning == true) {
            throw new Error("task fetch block exist, but start new one");
        }
        if (typeof this.monitor.onStartFetch == "function") {
            this.monitor.onStartFetch()
        }

        this.monitor.fetchBlockRunning = true;
        await this.monitorLatestHeight();
        await this.monitorTaskQueue();
        SystemOut.info("startFetch");

        if (this.monitor.taskBlockEventNow == undefined) {
            if (this.monitor.evmConfig == undefined)
                throw new Error("evmConfig not found");


            this.monitor.taskBlockEventNow = Number(this.monitor.evmConfig.start_block as string);
        }
        SystemOut.info("taskBlockEventNow:", this.monitor.taskBlockEventNow);

        if (this.monitor.blockFetchTaskList == undefined) {
            this.monitor.blockFetchTaskList = [];
        }

        const blockFetchTaskList = this.monitor.blockFetchTaskList;

        await this.startDispatch(blockFetchTaskList);

        if (this.monitor.evmRpcClient == undefined)
            throw new Error("evmRpcClient state error");


        const fetchers = startFetchEvent(this.monitor.evmRpcClient, blockFetchTaskList, this.monitor);
        this.fetchers = fetchers;
    }
    public async stopFetch() {
        this.stopDispatch()
    }
    private async getAndSetLatestHeight(): Promise<number> {
        await this.blockHeight(
            (err: Error, result: any) => {
                if (!err) {
                    if (this.historyMode) {
                        this.monitor.blockHeight = result;
                    } else {
                        this.monitor.realBlockHeight = parseInt(result, 16);
                        this.monitor.blockHeight = this.monitor.realBlockHeight - 6; // prevent chasing uncles
                    }
                    return;
                }
                SystemOut.error("get block error:", err);
            }
        );
        if (!_.isFinite(this.monitor.blockHeight)) {
            throw new Error("block number faild");
        }
        return this.monitor.blockHeight;
    }
    public async blockHeight(callback: Function) {
        if (this.historyMode) {
            callback(null, this.historyModeEndBlock);
            return;
        }

        if (this.monitor.evmRpcClient == undefined)
            throw new Error("evmRpcClient state error");


        let result: string;
        try {
            // SystemOut.debug("fetch blockchain height", "method:eth_blockNumber");
            result = await this.monitor.evmRpcClient.get().request({
                method: "eth_blockNumber",
                params: []
            }, 1000 * 8);
        } catch (error) {
            SystemOut.error(error);
            callback(error, null);
            return;
        }
        const printHeight = (hexString: string) => {
            if (!hexString || hexString == "") {
                return "---";
            }
            return parseInt(result.slice(2), 16).toString();
        };
        SystemOut.debug("latest blockchain height", printHeight(result));
        callback(null, result);
    }
}
