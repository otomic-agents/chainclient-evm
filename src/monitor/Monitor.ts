import {
  BlockFetchTask,
  EvmConfig,
  EvmRpcClient,
  MonitorWatchStatusInfo,
  FilterInfo,
} from "../interface/interface";
import BlockEventFetcher from "./BlockEventFetcher";
import EventFilter from "./EventFilter";
import Redis from "ioredis";
import {
  BlockFetchTask,
  EvmConfig,
  EvmRpcClient,
  MonitorWatchStatusInfo,
  FilterInfo,
} from "../interface/interface";
import BlockEventFetcher from "./BlockEventFetcher";
import EventFilter from "./EventFilter";
import Redis from "ioredis";

const CACHE_KEY_EVENT_HEIGHT = "CACHE_KEY_EVENT_HEIGHT";
const CACHE_KEY_EVENT_HEIGHT = "CACHE_KEY_EVENT_HEIGHT";

export interface HeightWatcher {
  onHeightUpdate: (height: number) => void;
}

function alignToNearest5(num: number): number {
  return Math.floor(num / 5) * 5;
  return Math.floor(num / 5) * 5;
}

export default class Monitor {
  restarting: boolean = false;

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

  modeHistory: boolean = false;

  heightWatchers: HeightWatcher[] = [];

  constructor() {
    this.statusWatcher = [];
  }
export default class Monitor {
  restarting: boolean = false;

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

  modeHistory: boolean = false;

  heightWatchers: HeightWatcher[] = [];

  constructor() {
    this.statusWatcher = [];
  }

  setConfigModeChase = async (
    redis: Redis,
    evmRpcClient: EvmRpcClient,
    evmConfig: EvmConfig
  ) => {
    this.redis = redis;
    this.evmRpcClient = evmRpcClient;
    this.evmConfig = evmConfig;

    let cache_height = await this.redis.get(
      `${CACHE_KEY_EVENT_HEIGHT}_${evmConfig.system_chain_id}`
    );
    console.log(
      "cache_key:",
      `${CACHE_KEY_EVENT_HEIGHT}_${evmConfig.system_chain_id}`
    );
    console.log("cache_height:", cache_height);
  setConfigModeChase = async (
    redis: Redis,
    evmRpcClient: EvmRpcClient,
    evmConfig: EvmConfig
  ) => {
    this.redis = redis;
    this.evmRpcClient = evmRpcClient;
    this.evmConfig = evmConfig;

    let cache_height = await this.redis.get(
      `${CACHE_KEY_EVENT_HEIGHT}_${evmConfig.system_chain_id}`
    );
    console.log(
      "cache_key:",
      `${CACHE_KEY_EVENT_HEIGHT}_${evmConfig.system_chain_id}`
    );
    console.log("cache_height:", cache_height);

    if (cache_height == undefined) {
      if (this.evmConfig.start_top_height == "true") {
        console.log("start_top_height true");
        if (this.blockEventFetcher == undefined) {
          this.blockEventFetcher = new BlockEventFetcher(
            this,
            this.modeHistory,
            0
          );
        }
        await this.blockEventFetcher.blockHeight((err: Error, result: any) => {
          if (!err) {
            this.evmConfig.start_block = (parseInt(result, 16) - 6).toString();
          } else {
            throw new Error("get height error");
          }
          console.log(
            "this.evmConfig.start_block update:",
            this.evmConfig.start_block
          );
        });
      } else {
        // nothing need to do
        // this.evmConfig.start_block = this.evmConfig.start_block
      }
    } else {
      this.evmConfig.start_block =
        parseInt(cache_height) > parseInt(this.evmConfig.start_block)
          ? cache_height
          : this.evmConfig.start_block;
    }
    if (cache_height == undefined) {
      if (this.evmConfig.start_top_height == "true") {
        console.log("start_top_height true");
        if (this.blockEventFetcher == undefined) {
          this.blockEventFetcher = new BlockEventFetcher(
            this,
            this.modeHistory,
            0
          );
        }
        await this.blockEventFetcher.blockHeight((err: Error, result: any) => {
          if (!err) {
            this.evmConfig.start_block = (parseInt(result, 16) - 6).toString();
          } else {
            throw new Error("get height error");
          }
          console.log(
            "this.evmConfig.start_block update:",
            this.evmConfig.start_block
          );
        });
      } else {
        // nothing need to do
        // this.evmConfig.start_block = this.evmConfig.start_block
      }
    } else {
      this.evmConfig.start_block =
        parseInt(cache_height) > parseInt(this.evmConfig.start_block)
          ? cache_height
          : this.evmConfig.start_block;
    }

    this.statusBlockHeight = alignToNearest5(
      parseInt(this.evmConfig.start_block)
    );
    this.taskBlockEventNow = this.statusBlockHeight;
    console.log(
      "set config finished:",
      this.evmConfig.start_block,
      this.statusBlockHeight,
      this.taskBlockEventNow
    );
  };

  setConfigModeHistory = async (
    evmRpcClient: EvmRpcClient,
    start: number,
    end: number
  ) => {
    this.modeHistory = true;
    this.blockHeight = end;
    this.statusBlockHeight = alignToNearest5(start);
    this.taskBlockEventNow = this.statusBlockHeight;
    this.evmRpcClient = evmRpcClient;
  };

  watch = (
    filter_info: FilterInfo,
    callback: Function,
    statusInfo: MonitorWatchStatusInfo
  ) => {
    console.group("on watch");

    console.log("filter_info:");
    console.log(filter_info);

    console.log("fetchBlockRunning", this.fetchBlockRunning);
    if (this.blockEventFetcher == undefined) {
      this.blockEventFetcher = new BlockEventFetcher(
        this,
        this.modeHistory,
        this.blockHeight
      );
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
    this.statusBlockHeight = alignToNearest5(
      parseInt(this.evmConfig.start_block)
    );
    this.taskBlockEventNow = this.statusBlockHeight;
    console.log(
      "set config finished:",
      this.evmConfig.start_block,
      this.statusBlockHeight,
      this.taskBlockEventNow
    );
  };

  setConfigModeHistory = async (
    evmRpcClient: EvmRpcClient,
    start: number,
    end: number
  ) => {
    this.modeHistory = true;
    this.blockHeight = end;
    this.statusBlockHeight = alignToNearest5(start);
    this.taskBlockEventNow = this.statusBlockHeight;
    this.evmRpcClient = evmRpcClient;
  };

  watch = (
    filter_info: FilterInfo,
    callback: Function,
    statusInfo: MonitorWatchStatusInfo
  ) => {
    console.group("on watch");

    console.log("filter_info:");
    console.log(filter_info);

    console.log("fetchBlockRunning", this.fetchBlockRunning);
    if (this.blockEventFetcher == undefined) {
      this.blockEventFetcher = new BlockEventFetcher(
        this,
        this.modeHistory,
        this.blockHeight
      );
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

    console.groupEnd();

    this.statusWatcher.push(statusInfo);
  };
    if (this.eventFilter == undefined) {
      this.eventFilter = new EventFilter(this);
    }

    this.eventFilter.startFilter(filter_info, callback);

    console.groupEnd();

    this.statusWatcher.push(statusInfo);
  };

  watchHeight = (watcher: HeightWatcher) => {
    this.heightWatchers.push(watcher);
  };
  watchHeight = (watcher: HeightWatcher) => {
    this.heightWatchers.push(watcher);
  };

  historyModeStart = () => {
    if (this.modeHistory && this.blockEventFetcher != undefined) {
      this.blockEventFetcher.startFetch();
      console.log("----------------------------> historyModeStart");
  historyModeStart = () => {
    if (this.modeHistory && this.blockEventFetcher != undefined) {
      this.blockEventFetcher.startFetch();
      console.log("----------------------------> historyModeStart");
    }
  };

  update_height = async (height: number) => {
    console.log("update_height:", height);
    this.statusBlockHeight = height;
  update_height = async (height: number) => {
    console.log("update_height:", height);
    this.statusBlockHeight = height;

    if (!this.modeHistory) {
      if (this.redis == undefined || this.evmConfig == undefined)
        throw new Error("db state error");
      console.log(
        "set height to redis",
        "redis_key:",
        `${CACHE_KEY_EVENT_HEIGHT}_${this.evmConfig.system_chain_id}`
      );
      try {
        await this.redis.set(
          `${CACHE_KEY_EVENT_HEIGHT}_${this.evmConfig.system_chain_id}`,
          height
        );
      } catch (e) {
        console.error("set redis height error:", e);
        console.error(e);
        throw e;
      }
    }

    for (const watcher of this.heightWatchers) {
      watcher.onHeightUpdate(height);
    for (const watcher of this.heightWatchers) {
      watcher.onHeightUpdate(height);
    }
  };
  };

  getStatus = async () => {
    return {
      block_height: this.statusBlockHeight,
      watcher: this.statusWatcher,
    };
  };
}

  getStatus = async () => {
    return {
      block_height: this.statusBlockHeight,
      watcher: this.statusWatcher,
    };
  };
}
