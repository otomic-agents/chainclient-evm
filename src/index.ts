// close db in this
import existSafe, { ExistTask } from "./serverUtils/ExistSafe";
existSafe({} as ExistTask)

// catch error and alert
import ErrorAlert from "./serverUtils/ErrorAlert";
const errorAlert = new ErrorAlert()

const stop = () => {
    console.log('on stop');
    if (server != undefined) {
        server.monitor.restarting = true

    }
}

const restart = async () => {
    console.log('on restart');
    if (server != undefined) {
        await server.evmRpcClient.saveBlackTemporary()
        await server.changeUrl()
        server.monitor.restarting = false
    }

}

const alert = (errorMessage: any) => {
    console.log('on alert', errorMessage);

}

errorAlert.start(stop, restart, alert)

import ChainClientEVM from "./server"
const server = new ChainClientEVM()
server.start()
