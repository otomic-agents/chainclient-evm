import { SystemBus } from "../bus/bus";
import { systemOutput } from "../utils/systemOutput";

export default class ErrorAlert {

    error_list: Error[] = []
    message_list: string[] = [];
    last_error_size: number = 0
    public constructor() {
        SystemBus.on("🚨", (message: Error) => {
            this.pushMessage(message.toString())
        })
        this.report_message_list()
    }
    private report_message_list() {
        systemOutput.debug("message_list_info")
        setInterval(() => {
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
    start = (stop: Function, restart: Function, onMessageError: Function) => {
        process.on('uncaughtException', (error: Error) => {

            console.log('on uncaughtException')
            this.error_list.push(error)
            console.log(error)

            stop()

            setTimeout(() => restart(), 10000)
        });

        process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {

            console.log('on unhandledRejection')
            this.error_list.push(reason)
            console.log(reason)

            stop()

            setTimeout(() => restart(), 10000)
        });

        setInterval(() => {
            console.log('check error list', this.error_list.length)
            if (this.error_list.length - this.last_error_size == 0) return

            this.last_error_size = this.error_list.length

            onMessageError({
                number: this.last_error_size,
                lastError: this.error_list[this.error_list.length - 1]
            })

        }, 1000 * 60 * 5)
    }
}