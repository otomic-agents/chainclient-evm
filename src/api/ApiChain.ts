import { SystemOut } from '../utils/systemOut'
import Router from '@koa/router'
import { EvmConfig, KoaCtx } from '../interface/interface'
import BaseApi from './BaseApi'
export default class ApiChain extends BaseApi {
  public linkRouter(router: Router, config: EvmConfig) {
    router.get("/chain/get_gas_price", this.handle_eth_gasPrice)
  }
  private handle_eth_gasPrice = (ctx: KoaCtx, next: Function) => {
    SystemOut.info("handle_eth_gasPrice")
    this.okResult(ctx, { message: "ok", result: "1" })
  }
}