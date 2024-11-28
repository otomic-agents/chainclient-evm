import Wallet from "./Wallet";
import { Service, Inject } from "typedi";
import TransactionManager from "./TransactionManager";
import { TransactionRequest } from "./TransactionManagerTypes";
import Config from "../config/Config";
import { SystemBus } from "../bus/bus";
import { throttledLog } from "../utils/comm";
const LOOP_STATUS_LOG = new throttledLog();
import { BigNumber, BigNumberish } from "ethers";

import * as _ from "lodash";
import {
  EvmConfig,
  EvmRpcClient,
  TransactionRequestCC,
  WalletConfig,
} from "../interface/interface";
import { SystemOut } from "../utils/systemOut";
import { ethers } from "ethers";
import axios from "axios";
const { dev, vault } = Config;
const MAX_MESSAGE = 10;
interface ErrorEntry {
  message: string;
  timestamp: Date;
}


@Service()
export default class TransactionCheckLoop {
  private wallet: Wallet;
  private transactionManager: TransactionManager;
  private evmRpcClient: EvmRpcClient;
  private evmConfig: EvmConfig;
  private currentFailNum: number;
  private errorMessage: ErrorEntry[] = [];

  public init(wallet: Wallet, transactionManager: TransactionManager, evmRpcClient: EvmRpcClient, evmConfig: EvmConfig) {
    this.wallet = wallet;
    this.transactionManager = transactionManager;
    this.evmRpcClient = evmRpcClient;
    this.evmConfig = evmConfig;
    this.currentFailNum = 0;
    this.reportTransactionErrors();
    this.startTransactionProcessLoop();
  }
  public async startTransactionProcessLoop() {
    const firstTransactionDataStr = this.transactionManager.getFirst();
    if (firstTransactionDataStr == undefined) {
      this.nextLoop()
      return;
    }
    const firstTransactionData: TransactionRequestCC = JSON.parse(firstTransactionDataStr);
    let firstTransaction: TransactionRequestCC = {} as TransactionRequestCC;
    firstTransaction = _.cloneDeep(firstTransactionData);
    delete firstTransaction.rawData;
    firstTransaction.chainId = Number(firstTransaction.chainId)

    SystemOut.debug("Transaction Queue Data 【Send】:", "🛍️ bid", _.get(firstTransactionData, "rawData.bid", ""));
    SystemOut.info(firstTransaction)
    SystemOut.info(firstTransactionData)
    await this.sendTransaction(firstTransaction, firstTransactionData);

    this.nextLoop()
  };
  /**
   * 
   * @param firstTransaction 
   * @param firstTransactionData has raw
   * @returns 
   */
  private async sendTransaction(
    firstTransaction: TransactionRequestCC,
    firstTransactionData: TransactionRequestCC
  ): Promise<void> {
    const gas_price = await this.transactionManager.gasManager.getDynamicGasPrice(Number(firstTransaction.chainId));
    if (gas_price === "-2") {
      SystemOut.error("Gas is too high, refusing transaction.");
      return;
    }
    if (gas_price === "-1") {
      delete firstTransaction.gasPrice;
      SystemOut.info("Remove the gas; let the ethers library decide the gas itself.");
    } else {
      SystemOut.info("Use the default gas or the gas obtained from the RPC.");
      firstTransaction.gasPrice = gas_price;
    }

    let provider = new ethers.providers.JsonRpcProvider(this.evmConfig.rpc_url);
    if (!firstTransaction.gasPrice) {
      SystemOut.info("🛍️ send transaction gasPrice", "ethlib auto set");
    } else {
      SystemOut.info("🛍️ send transaction gasPrice", ethers.utils.formatUnits(firstTransaction.gasPrice, "gwei"));
    }
    try {
      firstTransaction.value = ethers.BigNumber.from(firstTransaction.value);
      firstTransaction.gasLimit = 500000;
      if (firstTransactionData.rawData && _.get(firstTransactionData, "rawData.txType", "unknow") == "in") {
        SystemOut.debug("🔍ApproveCheck")
        const needApprove = await this.checkSufficientBalanceAndApproval(firstTransactionData, provider);
        if (needApprove == true) {
          await this.transactionManager.pushApproveToQueue(firstTransactionData);
          SystemOut.info("Waiting for next queue processing")
          return;
        }
      } else {
        SystemOut.debug("Direct send", "")
      }

      SystemOut.info("EstimateGas")
      await this.estimateGas(provider, firstTransaction);

      let transactionSended;
      transactionSended = await this.handleKeyAccountTransaction(firstTransaction, provider);
      SystemOut.info(`Transaction sent successfully. TxHash: ${transactionSended.hash},🛍️ bid: ${_.get(firstTransactionData, "rawData.bid", "")}`);
      firstTransactionData.transactionHash = transactionSended.hash;
      firstTransactionData.sended = transactionSended;
      await this.transactionManager.onTransactionNowSucceed(firstTransactionData);
      SystemBus.sendAction({ action: "transaction_send", payload: _.clone(firstTransactionData) });
      this.currentFailNum = 0;
    } catch (err) {
      this.handleTransactionError(err, firstTransactionData);
    }
  }
  /**
   * lfirstData include rawData 
   * @param err 
   * @param firstTransactionData 
   */
  private handleTransactionError(err: Error, firstTransactionData: TransactionRequestCC) {
    SystemOut.warn("Transaction failed to send", this.currentFailNum, "bid:", _.get(firstTransactionData, "rawData.bid", ""));
    SystemOut.error(err);
    const message = `Transaction failed to send, ${this.currentFailNum}  bid: ${_.get(firstTransactionData, "rawData.bid", "")} errMessage:${err.toString()}`
    this.recordLatestErrorMessage(message)

    SystemBus.emittery.emit("🚨", err);
    SystemOut.warn("this.failNum:", this.currentFailNum);
    this.currentFailNum++;
    if (this.currentFailNum >= 5) {
      firstTransactionData.error = err;
      SystemOut.warn("Sending ultimately failed.")
      SystemOut.warn(firstTransactionData)
      SystemBus.sendAction({ action: "transaction_send_failed", payload: _.clone(firstTransactionData) });
      this.transactionManager.onTransactionFailed(firstTransactionData);
      this.currentFailNum = 0;
    }
  }

  private async handleKeyAccountTransaction(firstTransaction: TransactionRequestCC, provider: ethers.providers.JsonRpcProvider): Promise<ethers.providers.TransactionResponse> {
    SystemOut.info("🪰 Handling key account transaction");
    let wallet = await this.wallet.getWalletItemByAddress(firstTransaction.from);
    if (wallet === undefined) {
      throw new Error("wallet not found");
    }
    const tx: any = firstTransaction as TransactionRequest;
    delete tx.from;
    tx.gasPrice = ethers.BigNumber.from(tx.gasPrice)
    console.log(tx)
    tx.nonce = await provider.getTransactionCount(wallet.address)
    const unsignedTx = ethers.utils.serializeTransaction(tx);
    SystemOut.debug(`unsignedTx:`, unsignedTx);
    const signedTx = await this.signTx(wallet, unsignedTx);
    const transactionSended = await provider.sendTransaction(signedTx);
    try {
      await Promise.race([transactionSended.wait(2), new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timed out')), 60000))]);
      SystemOut.info('🟩 Transaction confirmed:', transactionSended.hash);
      return transactionSended; // Assuming transactionSended.hash contains the transaction hash
    } catch (error) {
      SystemOut.info("🟥 Transaction send failed")
      throw new Error(`Send transaction error: ${error.toString()}`);
    }
  }
  private async signTx(wallet: WalletConfig, unsignedTx: string): Promise<string> {
    let signType = "lp"
    if (Config.isRelay() == true) {
      signType = "relay"
    }
    const url = `${wallet.signature_service_address}/${signType}/${Config.evm_config.system_chain_id}/signTx`
    let signData = ""
    SystemOut.debug("send tx sign", url)
    try {
      const signResponse = await axios.post(url, {
        txData: unsignedTx
      })
      signData = _.get(signResponse, "data.signedTx", "")
    } catch (e) {

    }
    return signData
  }
  private async checkSufficientBalanceAndApproval(firstTransactionData: TransactionRequestCC, provider: ethers.providers.JsonRpcProvider): Promise<boolean> {
    SystemOut.info("🪰 Checking if approval is needed");
    try {
      SystemOut.info("source data:")
      SystemOut.info(firstTransactionData)
      const walletInfos = await this.wallet.getWalletInfo();
      const token = ethers.BigNumber.from(firstTransactionData.rawData.token).toHexString();
      const wallet = walletInfos.filter((info) => {
        return (
          info.token.toLowerCase() == token.toLowerCase() &&
          info.wallet_name == firstTransactionData.rawData.sender_wallet_name
        );
      })[0];
      const balanceBig: BigNumber = ethers.BigNumber.from(wallet.balance_value);
      SystemOut.info(`token:${token} ,balance:${balanceBig.toString()}`);
      const c = new ethers.Contract(
        token,
        this.evmConfig.abi.erc20,
        new ethers.providers.JsonRpcProvider(this.evmConfig.rpc_url)
      );
      const tokenAmountBig = ethers.BigNumber.from(firstTransactionData.rawData["token_amount"])
      SystemOut.info("compared balance", balanceBig.toString(), tokenAmountBig.toString())
      if (tokenAmountBig.gt(balanceBig)) {
        throw new Error("Insufficient balance to pay");
      }
      const allowance: ethers.BigNumber = await c.allowance(wallet.wallet_address, firstTransactionData.to);
      SystemOut.info("Current Approved Amount", allowance.toString())
      SystemOut.info("compared", allowance.toString(), tokenAmountBig.toString())
      if (allowance.gt(tokenAmountBig)) {
        return false
      } else {
        return true
      }
    } catch (e) {
      SystemOut.error("approveCheck Error:", e)
      throw e
    }
  }
  private async estimateGas(provider: ethers.providers.JsonRpcProvider, firstTransaction: TransactionRequestCC): Promise<void> {
    SystemOut.info("🪰 Estimating gas");
    try {
      const gas_limit = await provider.estimateGas(
        firstTransaction as TransactionRequest
      );
      SystemOut.info("estimateGas succeeded.")
      firstTransaction.gasLimit = gas_limit.add(10000);

    } catch (estimateError) {
      if (
        estimateError.reason ==
        "execution reverted: ERC20: insufficient allowance" ||
        estimateError.reason ==
        "execution reverted: ERC20: transfer amount exceeds allowance" ||
        estimateError.reason ==
        "execution reverted: BEP20: transfer amount exceeds allowance"
      ) {
        const insufficientError: Error = new Error("insufficient allowance")
        SystemOut.error(insufficientError)
        throw insufficientError;
      }
      throw estimateError;
    }
  }
  private recordLatestErrorMessage(message: string) {
    SystemOut.info("🪰 Recording latest error message with timestamp");
    if (this.errorMessage.length >= MAX_MESSAGE) {
      this.errorMessage.shift(); // Remove the oldest message
    }
    this.errorMessage.push({
      message: message,
      timestamp: new Date() // Store the current time
    });
  }
  private reportTransactionErrors() {
    console.log("🪰 Reporting transaction errors with local and UTC time");
    if (this.errorMessage.length > 0) {
      console.log("\n=== Transaction Error Report ===");
      console.log(`Total Errors: ${this.errorMessage.length}`);
      console.log("Recent errors:\n");

      this.errorMessage.forEach((error, index) => {
        const utcTime = error.timestamp.toISOString();
        const localTime = error.timestamp.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
        console.log(`[${index + 1}] UTC Time: ${utcTime}`);
        console.log(`    Local Time: ${localTime}`);
        console.log(`    Error: ${error}`);
        console.dir(error, { depth: 5 })
        console.log("------------------------");
      });

      console.log("=== End of Error Report ===\n");
    }

    // Schedule next report
    setTimeout(() => {
      this.reportTransactionErrors();
    }, 1000 * 60); // Run every minute
  }

  private nextLoop() {
    setTimeout(() => {
      LOOP_STATUS_LOG.log(
        `Transaction Loop still running`, `${new Date().toISOString().replace(/T/, ' ').substring(0, 23)}`
      );
      this.startTransactionProcessLoop();
    }, 2000);
  }
}