import { Component, Logger, Autowired } from "koatty";
import { SystemBus } from "../../../src/bus/bus";
import * as _ from "lodash"
import { SystemOut } from "../../../src/utils/systemOut";
import { MongoDto } from "../Dto/MongoDto";
@Component()
export class Record {
  @Autowired()
  protected mongoDto: MongoDto
  constructor() {
    SystemBus.emittery.on("chain_event", async (payload: any) => {
      try {
        await this.onChainEvent(payload);
      } catch (error) {
        Logger.error(error);
      }
    })
  }
  private async onChainEvent(payload: any) {
    SystemOut.debug("Received an event", payload)
    const result = await this.mongoDto.getClient().db(this.mongoDto.conf.db).collection("bridges").find({}).toArray()
    console.log(result)
  }
}