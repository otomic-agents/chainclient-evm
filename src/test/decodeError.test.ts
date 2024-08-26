import { ethers } from "ethers";
import * as fs from "fs";
import * as abiSet from "../config/OtmoicV2ABI";
export function decodeContractError(
  contract: ethers.Contract,
  errorData: string
) {
  const contractInterface = contract.interface;
  const selecter = errorData.slice(0, 10);
  const errorFragment = contractInterface.getError(selecter);
  const res = contractInterface.decodeErrorResult(errorFragment, errorData);
  const errorInputs = errorFragment.inputs;

  let message;
  if (errorInputs.length > 0) {
    message = errorInputs
      .map((input, index) => {
        return `${input.name}: ${res[index].toString()}`;
      })
      .join(", ");
  }

  throw new Error(`${errorFragment.name} | ${message ? message : ""}`);
}

async function main() {
  const contractAddress = "0xYourContractAddress";
  const provider = new ethers.providers.JsonRpcProvider(
    "https://mainnet.infura.io/v3/YOUR_INFURA_API_KEY"
  );
  const abi = abiSet.default.abi;
  // console.log(abi);
  const contract = new ethers.Contract(contractAddress, abi, provider);
  // 0xe86b5ce300000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000066c88567000000000000000000000000000000000000000000000000000000000000000b7472616e7366657220696e000000000000000000000000000000000000000000;
  console.log(contract.interface.parseError("0x2c5211c6"));
  // console.log(contract.interface.parseError("0x2c5211c6"));
}
main()
  .then(() => {})
  .catch((e) => {
    console.error(e);
  });
