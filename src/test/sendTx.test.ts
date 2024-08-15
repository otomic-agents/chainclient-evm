import * as async from "async"
import { SystemOut } from "../utils/systemOut"
// console.log(ethers)
// const RPC = "https://public.stackup.sh/api/v1/node/bsc-testnet"
SystemOut.debug({ a: 1, b: 2 }, "3")
function c() {

    return new Promise((resolve) => {
        async.waterfall([
            (callback: any) => {
                (async () => {
                    console.log(1)
                    // console.log(callback)
                    // callback(null)
                    callback(null)
                })()

            },
            (callback: any) => {
                (async () => {
                    console.log(2)
                    callback(null)
                })()

            },
        ], function done(err: any, result: any) {
            console.log("ok")
            resolve(true)
        })

    })
}
c().then(() => {
    console.log("done")
})

