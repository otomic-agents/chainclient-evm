import { Component, Logger, Autowired } from "koatty";
import { RedisDto } from "../Dto/RedisDto";
import { SystemBus } from "../../../src/bus/bus";
import * as _ from "lodash"
@Component()
export class IncomingMessage {

  @Autowired()
  protected redisDto: RedisDto
  constructor() {
    this.init()
  }
  private init() {
    Logger.debug("IncomingMessage init")
    this.redisDto.redisIns.subscribe("SYSTEM:MESSAGE:CHANNEL", (err: any, resp: any) => {
      Logger.debug(`The subscription has been completed, resp ${resp}`)
    })
    this.redisDto.redisIns.on("message", (channel: string, message: string) => {
      this.onMessage(message)
    })
  }
  private onMessage(message: string) {
    try {
      const msg = JSON.parse(message);
      const emitType = _.get(msg, "action", undefined)
      if (!emitType) {
        throw new Error("emitType not found");
      }
      const payload = _.get(msg, "payload", undefined)
      SystemBus.emittery.emit(emitType, payload)
    } catch (error: any) {
      console.error("parse message error:", error)
    }
  }
}