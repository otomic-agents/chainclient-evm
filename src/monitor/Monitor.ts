import {
    BlockFetchTask,
    EvmConfig,
    EvmRpcClient,
    MonitorWatchStatusInfo,
    FilterInfo
} from "../interface/interface";
import BlockEventFetcher from "./BlockEventFetcher";
import EventFilter from "./EventFilter";
import Redis from "ioredis";
import { throttledLog } from '../utils/comm';
import { SystemOut } from "../utils/systemOut";
const HEIGHTLOG = new throttledLog();
const CACHE_KEY_EVENT_HEIGHT = "CACHE_KEY_EVENT_HEIGHT";
// Monitor
export interface HeightWatcher {
    onHeightUpdate: (height: number, filterId: string) => Promise<void>;
}

function alignToNearest5(num: number): number {
    return Math.floor(num / 5) * 5;
}

export default class Monitor {
    id: string = "";
    startTime: number = 0;
    restarting: boolean = false;
    public onStartFetch: Function = null;
    public onWatch: Function = null;
    public onFilter: Function = null;
    public onFilterData: Function = null;
    public onDispatch: Function = null;
    public onEndCall: Function = null
    public onDispatchTask: Function = null;
    statusWatcher: MonitorWatchStatusInfo[];
    redis: Redis | undefined;
    evmRpcClient: EvmRpcClient | undefined;
    evmConfig: EvmConfig | undefined;

    statusBlockHeight: number | undefined;

    blockEventFetcher: BlockEventFetcher | undefined;
    eventFilter: EventFilter | undefined;

    blockFetchTaskList: BlockFetchTask[] = [];

    fetchBlockRunning: boolean = false;
    taskBlockEventNow: number | undefined;

    realBlockHeight: number | undefined;
    blockHeight: number | undefined;
    blockHeightUpdateTime: number = 0;

    modeHistory: boolean = false;

    heightWatchers: HeightWatcher[] = [];

    constructor() {
        this.statusWatcher = [];
    }
    public setId(id: string) {
        this.id = id;
    }
    public setEvmConfig(evmConfig: EvmConfig) {
        this.evmConfig = evmConfig;
    }
    public setStartTime(time: number) {
        this.startTime = time;
    }
    public onEnd() {
        if (typeof this.onEndCall == "function") {
            this.onEndCall();
        }
        this.stopBlockEventFetcher();
        this.stopEventFilter();
    }
    private stopBlockEventFetcher() {
        if (this.blockEventFetcher != undefined) {
            this.blockEventFetcher.stopFetch();
        }
    }
    private stopEventFilter() {

    }
    setConfigModeChase = async (redis: Redis, evmRpcClient: EvmRpcClient, evmConfig: EvmConfig) => {
        this.redis = redis;
        this.evmRpcClient = evmRpcClient;
        this.evmConfig = evmConfig;

        const cache_height = await this.redis.get(`${CACHE_KEY_EVENT_HEIGHT}_${evmConfig.system_chain_id
            }`);
        console.log("cache_key:", `${CACHE_KEY_EVENT_HEIGHT}_${evmConfig.system_chain_id
            }`);
        console.log("cache_height:", cache_height);

        if (cache_height == undefined) {
            if (this.evmConfig.start_top_height == "true") {
                console.log("start_top_height true");
                if (this.blockEventFetcher == undefined) {
                    this.blockEventFetcher = new BlockEventFetcher(this, this.modeHistory, 0);
                }
                await this.blockEventFetcher.blockHeight((err: Error, result: any) => {
                    if (!err) {
                        this.evmConfig.start_block = (parseInt(result, 16) - 6).toString();
                    } else {
                        throw new Error("get height error");
                    }
                    console.log("this.evmConfig.start_block update:", this.evmConfig.start_block);
                });
            } else {
                // nothing need to do
                // this.evmConfig.start_block = this.evmConfig.start_block
            }
        } else {
            this.evmConfig.start_block = parseInt(cache_height) > parseInt(this.evmConfig.start_block) ? cache_height : this.evmConfig.start_block;
        }

        this.statusBlockHeight = alignToNearest5(parseInt(this.evmConfig.start_block));
        this.taskBlockEventNow = this.statusBlockHeight;
        console.log("set config finished:", this.evmConfig.start_block, this.statusBlockHeight, this.taskBlockEventNow);
    };

    setConfigModeHistory = async (evmRpcClient: EvmRpcClient, start: number, end: number) => {
        this.modeHistory = true;
        this.blockHeight = end;
        this.statusBlockHeight = alignToNearest5(start);
        this.taskBlockEventNow = this.statusBlockHeight;
        this.evmRpcClient = evmRpcClient;
    };

    watch = (filter_info: FilterInfo, callback: Function, statusInfo: MonitorWatchStatusInfo) => {
        if (typeof this.onWatch == "function") {
            this.onWatch(filter_info, callback, statusInfo)
        }
        console.log("filter_info:");
        console.log(filter_info);
        if (this.blockEventFetcher == undefined) {
            this.blockEventFetcher = new BlockEventFetcher(this, this.modeHistory, this.blockHeight);
            if (this.modeHistory == false) {
                console.log("start fetch");
                this.blockEventFetcher.startFetch();
            }
        } else {
            if (this.fetchBlockRunning == false) {
                if (this.modeHistory == false) {
                    console.log("start fetch");
                    this.blockEventFetcher.startFetch();
                }
            }
        }
        if (this.eventFilter == undefined) {
            this.eventFilter = new EventFilter(this);
        }
        this.eventFilter.startFilter(filter_info, callback);
        this.statusWatcher.push(statusInfo);
    };

    watchHeight = (watcher: HeightWatcher) => {
        this.heightWatchers.push(watcher);
    };

    historyModeStart = () => {
        if (this.modeHistory && this.blockEventFetcher != undefined) {
            this.blockEventFetcher.startFetch();
            SystemOut.info("----> historyModeStart");
        }
    };
    update_height = async (height: number, filterId: string) => {
        HEIGHTLOG.log(`set height state`, height);
        this.statusBlockHeight = height;
        this.blockHeightUpdateTime = new Date().getTime();
        if (!this.modeHistory) {
            if (this.redis == undefined || this.evmConfig == undefined)
                throw new Error("db state error");
            await this.redis.set(`${CACHE_KEY_EVENT_HEIGHT}_${this.evmConfig.system_chain_id
                }`, height);
        }
        const watchIndex = 0;
        for (const watcher of this.heightWatchers) {
            (async (height: number, watchIndex: number) => {
                watchIndex++;
                // systemOutput.debug(`🤡 Send height event: ${watchIndex} ,height:${height}`)
                await watcher.onHeightUpdate(height, filterId);
            })(height, watchIndex)
        }
    };

    getStatus = async () => { // view on dashboard
        return { block_height_update_time: this.blockHeightUpdateTime, chain_block_height: this.realBlockHeight, block_height: this.statusBlockHeight, watcher: this.statusWatcher };
    };
}
