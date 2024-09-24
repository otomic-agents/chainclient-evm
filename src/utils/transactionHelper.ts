import * as _ from "lodash";
import { ethers } from "ethers";
const AddressZero = "0x0000000000000000000000000000000000000000";
export class TransactionHelper {
  static format(besendTx: any) {
    const token = _.get(besendTx, "token", undefined)
    if (token == undefined) {
      throw new Error("token not found");
    }
    const tokenHex = ethers.BigNumber.from(token).toHexString()
    if (tokenHex == "0x00") {
      _.set(besendTx, "token", AddressZero)
    }
    return besendTx;
  }
}