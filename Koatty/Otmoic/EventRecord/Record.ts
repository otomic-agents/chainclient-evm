import { Component, Logger, Autowired } from "koatty";
import { SystemBus } from "../../../src/bus/bus";
import * as _ from "lodash"
import { SystemOut } from "../../../src/utils/systemOut";
import { MongoDto } from "../Dto/MongoDto";
//@ts-ignore
@Component()
export class Record {
    //@ts-ignore
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
        SystemBus.emittery.on("transaction_send", async (payload: any) => {
            try {
                await this.onSendTransaction(payload);
            } catch (error) {
                Logger.error(error);
            }
        })
        SystemBus.emittery.on("new_transaction_request", async (payload: string) => {
            const result = await this.mongoDto.getClient().db(this.mongoDto.conf.db).collection("chain_transaction_send_request").insertOne({
                "status": "padding",
                "error_count": 0,
                "raw": payload,
                "hash": "",
                "last_updated": new Date().getTime()
            })
        })
        SystemBus.emittery.on("transaction_send_failed", async (payload: any) => {
            try {
                await this.onSendTransaction(payload);
            } catch (error) {
                Logger.error(error);
            }
        })
    }
    private async onChainEvent(payload: any) {
        // SystemOut.info("Received an event", payload)
        const result = await this.mongoDto.getClient().db(this.mongoDto.conf.db).collection("chain_event").insertOne(payload)
        console.log(result)
    }
    private async onSendTransaction(payload: any) {
        // SystemOut.info("Received an send", payload)
        const result = await this.mongoDto.getClient().db(this.mongoDto.conf.db).collection("chain_transaction_send").insertOne(payload)
        console.log(result)
    }
    private async onSendTransactionFailed(payload: any) {
        // SystemOut.info("Received an onSendTransactionFailed", payload)
        const result = await this.mongoDto.getClient().db(this.mongoDto.conf.db).collection("chain_transaction_send_failed").insertOne(payload)
    }
}