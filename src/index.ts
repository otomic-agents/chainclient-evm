// close db in this
import existSafe, { ExistTask } from "./serverUtils/ExistSafe";
existSafe({} as ExistTask)

// catch error and alert
import ErrorAlert from "./serverUtils/ErrorAlert";
const errorAlert = new ErrorAlert()

const stop = () => {
    console.log('on stop');
    
}

const restart = () => {
    console.log('on restart');

}

const alert = (errorMessage: any) => {
    console.log('on alert', errorMessage);

}

errorAlert.start(stop, restart, alert)

import ChainClientEVM from "./server"
const server = new ChainClientEVM()
server.start()
