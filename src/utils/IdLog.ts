import * as AsyncHooks from 'async_hooks';
import { Context, Next } from 'koa';


class IdLog {
  private asyncLocalStorage: AsyncHooks.AsyncLocalStorage<string | number>;
  private asyncIdCounter: number;

  constructor() {
    this.asyncLocalStorage = new AsyncHooks.AsyncLocalStorage();
    this.asyncIdCounter = 0;
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

  private log(level: string, ...args: unknown[]): void {
    const asyncId = this.asyncLocalStorage.getStore() || 'SYSTEM';
    console.log(`[${new Date().toISOString()}] ${level} [AsyncId-${asyncId}]`, ...args);
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
    const id = ++this.asyncIdCounter;  // 自增 ID
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

const idLogger: IdLog = new IdLog();
export { IdLog, idLogger };