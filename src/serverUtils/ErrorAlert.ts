import { SystemBus } from "../bus/bus";
import { SystemOut } from "../utils/systemOut";
export default class ErrorAlert {
    error_list: Error[] = []
    message_list: string[] = [];
    last_error_size: number = 0
    public constructor() {
        this.report_message_list()
        this.listenEvent()
    }
    private listenEvent() {
        SystemBus.emittery.on("🚨", (message: Error) => {
            this.pushMessage(message.toString())
        })
        SystemBus.emittery.on("runError", (message: Error) => {
            this.pushMessage(message.toString())
        })
    }
    private report_message_list() {
        setInterval(() => {
            SystemOut.info("message_list_info")
            console.table(this.message_list)
        }, 1000 * 60)
    }
    private pushMessage(message: any) {
        // Check if the array length is already at its limit
        if (this.message_list.length >= 50) {
            // Remove the oldest message (first element) before adding the new one
            this.message_list.shift();
        }
        this.message_list.push(message)
    }
}