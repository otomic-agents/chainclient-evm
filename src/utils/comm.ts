export function throttle(func, delay) {
    let lastCall = 0;
    let lastArg;
    return function (...args) {
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
    private throttle = undefined;
    constructor(time = 10000) {
        this.throttle = throttle((message: string) => {
            console.log(message);
        }, time);
    }
    public log(message: string) {
        this.throttle(message);
    }
}