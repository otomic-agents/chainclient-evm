import { Redis } from 'ioredis';
import Monitor from './Monitor';
import { EvmConfig, EvmRpcClient, FilterInfo, MonitorWatchStatusInfo } from '../interface/interface';
import { systemOutput } from '../utils/systemOutput';
import BlockEventFetcher from './BlockEventFetcher';

const { v4: uuidv4 } = require('uuid');
enum MoniterWrokType {
  'History' = 'History',
  'Realtime' = 'Realtime',
  'Null' = 'Null'
}
function generateUUID() {
  return uuidv4(); // Generate a v4 UUID.
}
class MonitorManager {
  private static instance: MonitorManager | null = null;
  private monitorList: Map<string, {
    monitor: Monitor,
    status: {
      id: string,
      init: boolean,
      mode: MoniterWrokType,
      fetchStartTime: number,
      filters: { filter_info: FilterInfo, callback: Function, statusInfo: MonitorWatchStatusInfo }[],
      filterStatus: {
        lastTime: number
        lastData: any
      }
      dispatchStatus: { lastTime: number }
    }
  }> = new Map()
  constructor() { }
  public static getInst(): MonitorManager {
    if (!MonitorManager.instance) {
      MonitorManager.instance = new MonitorManager();
    }
    return MonitorManager.instance;
  }
  public createMonitor(monitorName: string): Monitor {
    const mid = generateUUID()
    const monitor = new Monitor();
    monitor.setStartTime(new Date().getTime())
    monitor.setId(mid)
    const filters: { filter_info: FilterInfo, callback: Function, statusInfo: MonitorWatchStatusInfo }[] = new Array()
    const dispatchStatus: { lastTime: number, isEnd: boolean } = { lastTime: 0, isEnd: false }
    const filterStatus: {
      lastTime: number
      lastData: any
    } = {
      lastData: "",
      lastTime: 0,
    }
    this.monitorList.set(monitorName, {
      monitor,
      status: {
        id: mid,
        init: false,
        mode: MoniterWrokType.Null,
        fetchStartTime: 0,
        filters: filters,
        filterStatus,
        dispatchStatus,
      }
    })
    monitor.onStartFetch = () => {

    }
    monitor.onWatch = (filter_info: FilterInfo, callback: Function, statusInfo: MonitorWatchStatusInfo) => {
      filters.push({
        filter_info,
        callback,
        statusInfo
      })
    }
    monitor.onFilter = () => {
      filterStatus.lastTime = new Date().getTime()
    }
    monitor.onFilterData = (data: any) => {
      filterStatus.lastData = data
    }
    monitor.onDispatch = () => {
      dispatchStatus.lastTime = new Date().getTime();
    }
    monitor.onDispatchTask = () => {

    }
    monitor.onEndCall = () => {
      dispatchStatus.isEnd = true;
    }
    return monitor;
  }
  private isInit(monitorName: string): boolean {
    const monitorIns = this.monitorList.get(monitorName)
    if (!monitorIns) {
      throw new Error('monitor not found')
    }
    if (monitorIns.status.init == false) {
      throw new Error('monitor is inited');
    }
    return true
  }
  public async initMoniter(monitorName: string, redis: Redis, evmRpcClient: EvmRpcClient, evmConfig: EvmConfig) {
    const monitorIns = this.monitorList.get(monitorName)
    if (!monitorIns) {
      throw new Error('monitor not found')
    }
    if (monitorIns.status.init == true) {
      throw new Error('monitor is inited');
    }
    monitorIns.status.mode = MoniterWrokType.Realtime
    monitorIns.monitor.setConfigModeChase(redis, evmRpcClient, evmConfig);
  }
  public async initMoniterAsHistory(monitorName: string, evmRpcClient: EvmRpcClient, startBlock: number, endBlock: number) {
    const monitorIns = this.monitorList.get(monitorName)
    if (!monitorIns) {
      throw new Error('monitor not found')
    }
    if (monitorIns.status.init == true) {
      throw new Error('monitor is inited');
    }
    monitorIns.status.mode = MoniterWrokType.History
    monitorIns.monitor.setConfigModeHistory(evmRpcClient, startBlock, endBlock);
  }
  public getMoniterStatus() {
    const monitors: {
      monitor: Monitor,
      status: {
        id: string,
        init: boolean,
        mode: MoniterWrokType,
        fetchStartTime: number
        filters: { filter_info: FilterInfo, callback: Function, statusInfo: MonitorWatchStatusInfo }[]
        filterStatus: {
          lastTime: number
          lastData: any
        },
        dispatchStatus: {
          lastTime: Number
        }
      }
    }[] = []
    for (const [, moniter] of this.monitorList) {
      monitors.push(moniter)
    }
    return monitors
  }
}
export {
  MonitorManager
}

