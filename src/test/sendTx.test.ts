import * as async from "async"
import _ from "lodash";
const { ethers } = require('ethers');
// console.log(ethers)
const RPC = "https://public.stackup.sh/api/v1/node/bsc-testnet"
async.waterfall(
    [
        function (callback){
            callback(null)
        },
        function (callback){
            callback(null)
        },
        // function preInfo(callback) {
        //     const tx = {
        //         to: '0xE09795702F95ff8Df93f41043f31C8A3b1789b8B',
        //         from: '0x1E1f3324f5482bACeA3E07978278624F28e4ca4A',
        //         data: '0x7a2927460000000000000000000000001e1f3324f5482bacea3e07978278624f28e4ca4a000000000000000000000000945e9704d2735b420363071bb935acf2b9c4b814000000000000000000000000acda8bf66c2cadac9e99aa1aa75743f536e71094000000000000000000000000000000000000000000000001ffcace8081782c00000000000000000000000000000000000000000000000000000000000000000089ef37b50d7303fc0eb9b079c85a5b1b058b7fc2cc2f2077e4d6495b442771da000000000000000000000000000000000000000000000000000000000000007800000000000000000000000000000000000000000000000000000000000001f500000000000000000000000000000000c5f94d9e92d06f557d861fcb66107d820000000000000000000000000000000000000000000000000000000066aa53dd',
        //         value: '0',
        //         gasPrice: 'FAST',
        //         chainId: 97
        //     }
        //     callback(null, { tx })
        // },
        // async function eGas(preInfo: { tx: { to: string, from: string, data: string, value: string, gasPrice: string, chainId: number } }, callback) {
        //     const provider = new ethers.providers.JsonRpcProvider(RPC, {
        //         chainId: 97,
        //         name: "bsc-testnet",
        //     });
        //     delete preInfo.tx.gasPrice
        //     try{
        //         await provider.estimateGas(preInfo.tx)
        //     }catch(e){
        //         console.log(e.reason)
        //     }
        //     callback(null, { tx: preInfo.tx })
        // },
        // function preTxSendFun(preInfo: { tx: { to: string, from: string, data: string, value: string, gasPrice: string, chainId: number } }, callback) {
        //     console.log(preInfo)
        //     const provider = new ethers.providers.JsonRpcProvider(RPC, {
        //         chainId: 97,
        //         name: "bsc-testnet",
        //     });
        //     let wallet = new ethers.Wallet("", provider);
        //     const sendTx = async () => {
        //         console.log(`Attempting to send transaction from ${wallet.address} to ${preInfo.tx.to}`);
        //         const tx = preInfo.tx
        //         delete tx.gasPrice
        //         // 6. Sign and send tx - wait for receipt

        //         try {
        //             const createReceipt = await wallet.sendTransaction(tx);
        //             await createReceipt.wait();
        //             console.log(`Transaction successful with hash: ${createReceipt.hash}`);
        //         } catch (e) {
        //             console.error("send tx error", e.reason)
        //         }


        //     };
        //     callback(null, sendTx)
        // },
        // function send(sendFun: Function, callback: any) {
        //     sendFun()
        // }
    ],
    function done(err: any, result: any) {
        console.log(!err)
    }
)