import * as AsyncHooks from 'async_hooks';
import { Context, Next } from 'koa';
import * as path from 'path';

// Define log level types
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class IdLog {
  private asyncLocalStorage: AsyncHooks.AsyncLocalStorage<string | number>;
  private asyncIdCounter: number;
  private projectRoot: string;
  private logLevel: LogLevel; // Use LogLevel type
  private timeMarkers: Map<string, number>; // Used for performance tracking

  constructor() {
    this.asyncLocalStorage = new AsyncHooks.AsyncLocalStorage();
    this.asyncIdCounter = 0;
    this.projectRoot = process.cwd();
    this.logLevel = 'DEBUG'; // Default to showing all logs
    this.timeMarkers = new Map();
  }

  // Set the log level
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public info(...args: unknown[]): void {
    this.log('INFO', ...args);
  }

  public warn(...args: unknown[]): void {
    this.log('WARN', ...args);
  }

  public error(...args: unknown[]): void {
    this.log('ERROR', ...args);
  }

  public debug(...args: unknown[]): void {
    this.log('DEBUG', ...args);
  }

  // Start performance tracking
  public time(label: string): void {
    this.timeMarkers.set(label, performance.now());
  }

  // End performance tracking
  public timeEnd(label: string): void {
    const startTime = this.timeMarkers.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.info(`${label}: ${duration.toFixed(2)}ms`);
      this.timeMarkers.delete(label);
    } else {
      this.warn(`No such label: ${label}`);
    }
  }

  private getCallerLocation(): string {
    const stackLines = new Error().stack?.split('\n') || [];
    const callerLine = stackLines[4] || '';
    const match = callerLine.match(/at\s+(?:.*\s+\()?(.+?):(\d+):\d+/);
    if (match) {
      const [filePath, line] = match.slice(1, 3);
      const relativePath = path.relative(this.projectRoot, filePath); // Convert to relative path
      return `${relativePath}:${line}`;
    }
    return 'unknown location';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private log(level: LogLevel, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return; // Control output based on log level

    const asyncId = this.asyncLocalStorage.getStore() || 'SYSTEM';
    const callerLocation = this.getCallerLocation();

    // Format fields
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] [${level}] [AsyncId-${asyncId}] [${callerLocation}]`, ...args);
  }

  public createAsyncContextMiddleware() {
    return async (ctx: Context, next: Next): Promise<void> => {
      await new Promise<void>((resolve) => {
        this.asyncLocalStorage.run(`${++this.asyncIdCounter}`, async () => {
          try {
            await next();
            resolve();
          } catch (error) {
            this.error('Error handling request:', error);
            resolve();
          }
        });
      });
    };
  }

  public runWithId<T>(id: string | number, callback: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.asyncLocalStorage.run(id, async () => {
        try {
          const result = await callback();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public runWithIdInc<T>(callback: () => Promise<T> | T): Promise<T> {
    if (this.asyncIdCounter >= Number.MAX_SAFE_INTEGER) {
      this.asyncIdCounter = 0; // Reset counter to avoid exceeding MAX_SAFE_INTEGER
    }
    const id = ++this.asyncIdCounter; // Increment ID
    return new Promise<T>((resolve, reject) => {
      this.asyncLocalStorage.run(id, async () => {
        try {
          const result = await callback();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}

// Export the instance and class
const idLogger: IdLog = new IdLog();
export { IdLog, idLogger };
