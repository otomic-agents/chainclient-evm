import { Service, Inject, Container } from "typedi";
import { SystemOut } from "../utils/systemOut";
import axios from "axios";
import to from 'await-to-js';
import { getGasPrice, getMaxGasPrice } from "./TransactionManagerGas";
import { BigNumber, ethers } from "ethers";
import BN from "bignumber.js";
import * as _ from "lodash";
import { EvmConfig } from "../interface/interface";
const gasIncrease: Map<number, number> = new Map()
gasIncrease.set(0, 130)
gasIncrease.set(1, 160)
gasIncrease.set(56, 130)

function getRequiredGasIncrease(key: number): number {
  if (typeof key === 'number' && !isNaN(key)) {
    if (gasIncrease.has(key)) {
      return gasIncrease.get(key)!;
    }
  }
  return gasIncrease.get(0)!;
}
@Service()
export default class GasManager {
  private rpcGas: string = null;
  getDynamicGasPriceFunction: Function;
  private getDynamicGasPriceFunctionResult: string = null; // {id:2,result:"0x23"}
  private evmConfig: EvmConfig;
  public setEvmConfig(evmConfig: EvmConfig) {
    this.evmConfig = evmConfig;
    this.initLocalGasPrice();
    this.keepDynamicGasPrice();
  }
  private initLocalGasPrice() {
    this.getDynamicGasPriceFunction = async (input: any, callback: any) => {
      const requestObject: { jsonrpc: string; method: string; params: never[]; id: number } = {
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1,
      };


      SystemOut.info("request ", input.rpcUrl, "method", "eth_gasPrice");
      const [err, response] = await to(axios.post(input.rpcUrl, requestObject, {
        timeout: 3000,
        headers: {
          "Content-Type": "application/json",
        },
      }));
      if (err) {
        callback(new Error(`get gasPriceError ${err.toString()}`), null);
        return
      }
      if (!response || !response.data) {
        callback(new Error("Invalid response received."), null)
        return
      }
      callback(null, JSON.stringify(_.get(response, "data", "{}")));
    };
  }
  public async getDynamicGasPrice(chainId: number): Promise<string> {
    let useDefaultGas = false;
    const maxGasPrice = getMaxGasPrice(this.evmConfig);
    const rpcGas = this.rpcGas;
    if (maxGasPrice == "-1") {
      SystemOut.warn("No maximum gas set, using def value.");
      useDefaultGas = true;
    }
    SystemOut.debug("maxGas", maxGasPrice, ethers.utils.formatUnits(maxGasPrice, "gwei"), "rpcGas", this.rpcGas, ethers.utils.formatUnits(rpcGas, "gwei"))
    try {
      if (new BN(rpcGas).toString() == "NaN") {
        SystemOut.warn("Processing gas error, using default value.");
        useDefaultGas = true;
      } else if (new BN(rpcGas).comparedTo(new BN(maxGasPrice)) > 0) {
        SystemOut.warn("rpcGas is too high ,use DefaultGas");
        useDefaultGas = true;
      }
    } catch (e) {
      useDefaultGas = true;
      SystemOut.warn("Processing gas error, using default value.");
    }

    let gasPrice;
    if (useDefaultGas) {
      gasPrice = (await getGasPrice("", this.evmConfig)).toString();
      if (gasPrice == "-1") {
        SystemOut.warn(" default gas not set ,use auto gas ");
        return "-1";
      } else {
        SystemOut.info("use default gas")
        return gasPrice
      }
    }
    SystemOut.info("use rpcGas")
    gasPrice = rpcGas;
    let gas_price: BigNumber = BigNumber.from(gasPrice);
    let increasedGasPrice = gas_price.mul(getRequiredGasIncrease(chainId)).div(100);
    gasPrice = increasedGasPrice.toString()
    SystemOut.info(`Increase by ${getRequiredGasIncrease(chainId)}%`, "result:", ethers.utils.formatUnits(gasPrice, "gwei"));
    return gasPrice;
  }
  private async updateDynamicGasPrice() {
    try {
      const rpcResponse = JSON.parse(this.getDynamicGasPriceFunctionResult);
      if (
        _.get(rpcResponse, "id", 0) > 0 &&
        _.get(rpcResponse, "result", null) != null
      ) {
        const sourcePrice = new BN(_.get(rpcResponse, "result", ""), 16);
        const increasedByTwentyPercent = sourcePrice.times(new BN(12)).div(new BN(10)); // * 1.2
        this.rpcGas = increasedByTwentyPercent.toFixed(0).toString(); // "100000000000000000000000000";
        SystemOut.debug(`rpcGas set`, this.rpcGas, "Gwei:", ethers.utils.formatUnits(this.rpcGas, "gwei"));
      }
    } catch (e) {
      SystemOut.error(e);
    }
  }
  private async keepDynamicGasPrice() {
    const next = () => {
      setTimeout(() => {
        this.keepDynamicGasPrice();
      }, 1000 * 20);
    }
    const [err, gasResult]: [Error, string] = await to(new Promise((resolve, reject) => {
      const callData = { rpcUrl: this.evmConfig.rpc_url, method: "getGasPrice" }
      this.getDynamicGasPriceFunction(
        JSON.parse(JSON.stringify(callData)),
        (err: Error, result: string) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        }
      );
    }));
    if (err) {
      SystemOut.error("get Gas error:", err);
      next();
      return;
    }
    this.getDynamicGasPriceFunctionResult = gasResult;
    this.updateDynamicGasPrice();
    next();
  }
}
