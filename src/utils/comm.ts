import { SystemOut } from "./systemOut";

import { v4 as uuidv4 } from 'uuid';
export function throttle(func: Function, delay: number) {
    let lastCall = 0;
    let lastArg: any;
    return function (...args: any[]) {
        const now = Date.now();
        if (now - lastCall < delay) {
            lastArg = args;
        } else {
            func.apply(this, lastArg || args);
            lastCall = now;
            lastArg = null;
        }
    };
}
export class throttledLog {
    private throttle: any = undefined;
    constructor(time = 10000) {
        this.throttle = throttle((...args: any[]) => {
            SystemOut.info(...args)
        }, time);
    }
    public log(...args: any[]) {
        const message = args.join(' ');
        this.throttle(message);
    }
}

export class UniqueIDGenerator {
    private static id: number = 0;

    public static getNextID(): number {
        if (UniqueIDGenerator.id >= Number.MAX_SAFE_INTEGER) {
            // Reset to 0 if reached max safe integer
            UniqueIDGenerator.id = 0;
        } else {
            UniqueIDGenerator.id++;
        }

        return UniqueIDGenerator.id;
    }
}
export class UUIDGenerator {
    static generateUUID(): string {
        return uuidv4();
    }
}