
export default class ErrorAlert {

    error_list: Error[] = []

    last_error_size: number = 0

    start = (stop: Function, restart: Function, onMessageError: Function) => {
        process.on('uncaughtException', (error: Error) => {

            console.log('on uncaughtException')
            this.error_list.push(error)
            console.log(error)
        
            stop()
        
            setTimeout(() => restart(), parseInt(process.env.RESTART_TIME as string))
        });
        
        process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
        
            console.log('on unhandledRejection')
            this.error_list.push(reason)
            console.log(reason)
        
            stop()
        
            setTimeout(() => restart(), parseInt(process.env.RESTART_TIME as string))
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