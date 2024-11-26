import * as async_hooks from 'async_hooks';
import * as path from 'path';

interface TimerInfo {
  startTime: number;
  label: string;
  extraArgs: any[];
}

interface AsyncInfo {
  createTime: number;
  rootId: number;
}

class IdLog {
  private static instance: IdLog;
  private asyncHook: async_hooks.AsyncHook;
  private rootAsyncIds: Map<number, AsyncInfo>;
  private forceNewRoot: Set<number>;
  private timers: Map<string, TimerInfo>;

  private readonly TIMER_CLEANUP_INTERVAL = 5 * 60 * 1000;
  private readonly TIMER_MAX_AGE = 10 * 60 * 1000;
  private readonly ASYNC_ID_CLEANUP_INTERVAL = 30 * 60 * 1000;
  private readonly ASYNC_ID_MAX_AGE = 2 * 60 * 60 * 1000;

  private constructor() {
    this.rootAsyncIds = new Map<number, AsyncInfo>();
    this.forceNewRoot = new Set<number>();
    this.timers = new Map<string, TimerInfo>();

    this.setupAsyncHook();
    this.setupCleanupTasks();
  }

  private setupAsyncHook(): void {
    this.asyncHook = async_hooks.createHook({
      init: (asyncId: number, type: string, triggerAsyncId: number) => {
        const now = Date.now();
        if (this.forceNewRoot.has(triggerAsyncId)) {
          this.rootAsyncIds.set(asyncId, { createTime: now, rootId: asyncId });
        } else if (this.rootAsyncIds.has(triggerAsyncId)) {
          const rootId = this.rootAsyncIds.get(triggerAsyncId)!.rootId;
          this.rootAsyncIds.set(asyncId, { createTime: now, rootId });
        } else {
          this.rootAsyncIds.set(asyncId, { createTime: now, rootId: asyncId });
        }
      },
      destroy: (asyncId: number) => {
        this.rootAsyncIds.delete(asyncId);
        this.forceNewRoot.delete(asyncId);
      }
    });
    this.asyncHook.enable();
  }

  private setupCleanupTasks(): void {
    setInterval(() => this.cleanupTimers(), this.TIMER_CLEANUP_INTERVAL);
    setInterval(() => this.cleanupAsyncIds(), this.ASYNC_ID_CLEANUP_INTERVAL);
  }

  private cleanupTimers(): void {
    const now = Date.now();
    this.timers.forEach((timer, label) => {
      if (now - timer.startTime > this.TIMER_MAX_AGE) {
        this.warn(`Timer '${label}' expired after ${this.TIMER_MAX_AGE / 60000} minutes`);
        this.timers.delete(label);
      }
    });
  }

  private cleanupAsyncIds(): void {
    const now = Date.now();
    this.rootAsyncIds.forEach((info, id) => {
      if (now - info.createTime > this.ASYNC_ID_MAX_AGE) {
        this.rootAsyncIds.delete(id);
        this.forceNewRoot.delete(id);
      }
    });
  }

  public static getInstance(): IdLog {
    if (!IdLog.instance) {
      IdLog.instance = new IdLog();
    }
    return IdLog.instance;
  }

  public markAsNewRoot(): void {
    const asyncId = async_hooks.executionAsyncId();
    this.forceNewRoot.add(asyncId);
    this.rootAsyncIds.set(asyncId, { createTime: Date.now(), rootId: asyncId });
  }

  private getRootAsyncId(): number {
    const asyncId = async_hooks.executionAsyncId();
    const asyncInfo = this.rootAsyncIds.get(asyncId);
    return asyncInfo ? asyncInfo.rootId : asyncId;
  }

  private getStackTrace(): string {
    const err = {} as Error;
    Error.captureStackTrace(err);
    const stackLines = err.stack?.split('\n') || [];
    const callSite = stackLines[4] || '';

    const match = callSite.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) ||
      callSite.match(/at\s+()(.*):(\d+):(\d+)/);

    if (match) {
      const [, method, file, line] = match;
      const fileName = file ? path.basename(file) : '';
      return `[${fileName}:${line}${method ? ` ${method}` : ''}]`;
    }

    return '';
  }

  private log(level: string, args: any[]): void {
    const rootAsyncId = this.getRootAsyncId();
    const timestamp = new Date().toISOString();
    const formattedAsyncId = `[AsyncId-${rootAsyncId.toString().padStart(5, ' ')}]`;
    const trace = this.getStackTrace();
    console.log(`[${timestamp}] ${level} ${formattedAsyncId} ${trace}`, ...args);
  }

  public time(label: string, ...extraArgs: any[]): void {
    if (this.timers.has(label)) {
      this.warn(`Timer '${label}' already exists`);
      return;
    }
    this.timers.set(label, { startTime: Date.now(), label, extraArgs });
    if (extraArgs.length > 0) {
      this.info(`Starting '${label}'`, ...extraArgs);
    }
  }

  public timeEnd(label: string, ...extraArgs: any[]): void {
    const timerInfo = this.timers.get(label);
    if (!timerInfo) {
      this.warn(`Timer '${label}' does not exist`);
      return;
    }

    const duration = Date.now() - timerInfo.startTime;
    this.timers.delete(label);

    let formattedDuration: string;
    if (duration < 1000) {
      formattedDuration = `${duration}ms`;
    } else if (duration < 60000) {
      formattedDuration = `${(duration / 1000).toFixed(2)}s`;
    } else {
      formattedDuration = `${(duration / 60000).toFixed(2)}min`;
    }

    this.info(`${label}: ${formattedDuration}`, ...timerInfo.extraArgs, ...extraArgs);
  }

  public info(...args: any[]): void {
    this.log('INFO', args);
  }

  public warn(...args: any[]): void {
    this.log('WARN', args);
  }

  public error(...args: any[]): void {
    this.log('ERROR', args);
  }

  public debug(...args: any[]): void {
    this.log('DEBUG', args);
  }
}

const idLogger = IdLog.getInstance();
export default idLogger;
