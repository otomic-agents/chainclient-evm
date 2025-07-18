import { KoaCtx } from '../interface/interface'
export default class BaseApi {
  public okResult(ctx: KoaCtx, data: Object) {
    ctx.body = Object.assign({code:0},data);
  }
}