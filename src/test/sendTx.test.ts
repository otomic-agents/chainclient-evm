import * as async from "async"
// console.log(ethers)
// const RPC = "https://public.stackup.sh/api/v1/node/bsc-testnet"

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

