import Emittery from 'emittery';
import Config from '../config/Config';
const emittery: Emittery = new Emittery();

interface SysAction {
    action: string;
    payload: any;
}
import Redis, { RedisOptions } from "ioredis";
import { SystemOut } from '../utils/systemOut';
let busRedis: Redis = null;
const opt: RedisOptions = {
    host: Config.redis_config.host,
    port: parseInt(Config.redis_config.port as string),
    db: Config.redis_config.db,
    password: Config.redis_config.pwd,
    retryStrategy: () => {
        const delay = 3000;
        return delay;
    }
};
busRedis = new Redis(opt);
class SystemBus {
    static emittery: Emittery = emittery;
    static sendAction(action: SysAction) {
        busRedis.publish("SYSTEM:MESSAGE:CHANNEL", JSON.stringify(action)).catch((e) => {
            SystemOut.error(e);
        })
    }
}
export {
    SystemBus,
    SysAction
}
