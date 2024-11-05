import needle from 'needle';
import { Service, Inject } from "typedi";
import { ethers } from 'ethers';
import bcrypt from 'bcrypt';
import {
  EvmConfig,
} from "../interface/interface";
import Config from "../config/Config";
const { vault } = Config;
@Service()

export default class VaultSigner {
  public async vaultSign(txData: any, evmConfig: EvmConfig, secert_id: string) {
    return new Promise(async (resolve, reject) => {
      const timestamp = (new Date().getTime() / 1000).toFixed(0);
      const text = vault.OS_API_KEY + timestamp + vault.OS_API_SECRET;
      const token = await bcrypt.hash(text, 10);

      const body = {
        app_key: vault.OS_API_KEY,
        timestamp: parseInt(timestamp),
        token: token,
        perm: {
          group: "secret.vault",
          dataType: "key",
          version: "v1",
          ops: ["Sign"],
        },
      };

      try {
        const accessToken = await this.getAccessToken(body);
        const response = await this.signTransaction(txData, accessToken, evmConfig, secert_id);
        resolve(response);
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  }

  private async getAccessToken(body: any): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      needle.post(
        `http://${vault.SERVER_URL}/permission/v1alpha1/access`,
        body,
        { headers: { "Content-Type": "application/json" } },
        (err, resp) => {
          if (err) {
            console.error("Error obtaining access token:", err);
            reject(err);
          } else {
            resolve(resp.body.data.access_token);
          }
        }
      );
    });
  }

  private async signTransaction(txData: any, accessToken: string, evmConfig: EvmConfig, secert_id: string) {
    return new Promise((resolve, reject) => {
      needle.post(
        `http://${vault.SERVER_URL}/system-server/v1alpha1/key/secret.vault/v1/Sign`,
        {
          safe_type: "UNSAFE",
          chain_type: "EVM",
          data: {
            sign_type: "CONTRACT_ENCODING_COMPLETED",
            secert_id: secert_id,
            to_address: txData.to,
            chain_id: ethers.BigNumber.from(evmConfig.chain_id).toHexString().substring(2),
            nonce: ethers.BigNumber.from(txData.nonce).toHexString().substring(2),
            is1155: false,
            gas_limit: txData.gasLimit.toHexString().substring(2),
            gas_price: ethers.BigNumber.from(txData.gasPrice).toHexString().substring(2),
            transaction_data: txData.data.substring(2),
            amount: ethers.BigNumber.from(txData.value).toHexString().substring(2),
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Access-Token": accessToken,
          },
        },
        (err, resp) => {
          if (!err && resp.body && resp.body.data && resp.body.data.data && resp.body.data.data.data) {
            resolve(resp.body.data.data.data);
          } else {
            console.error("Error during transaction signing:", err);
            reject(err);
          }
        }
      );
    });
  }
}
