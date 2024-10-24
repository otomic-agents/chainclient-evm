import {
  EvmConfig,
  EvmRpcClient,
  TransactionRequestCC,
} from "../interface/interface";
import { BigNumber, BigNumberish, BytesLike, ethers } from "ethers";
const getMaxGasPrice = (evmConfig: EvmConfig): string => {
  switch (evmConfig.system_chain_id) {
    case "9006": //BSC
      return ethers.utils.parseUnits('8', 'gwei').toString();
    case "9000": //AVAX
      // return 26000000010;
      return "-1";
    case "60":
      return "-1";
    case "966":
      return "-1";
    case "614":
      return ethers.utils.parseUnits('1', 'gwei').toString();
    default:
      return "-1";
  }
};
const getGasPrice = async (
  flag: string,
  evmConfig: EvmConfig
): Promise<number> => {
  switch (evmConfig.system_chain_id) {
    case "9006": //BSC
      if (evmConfig.chain_id === "97") return 5000000001;
      else return 5000000010;
      return -1;
    case "9000": //AVAX
      // return 26000000010;
      return -1;
    case "60":
      return -1;
    case "966":
      return -1;
    default:
      return -1;
  }
};
export {
  getGasPrice,
  getMaxGasPrice
}