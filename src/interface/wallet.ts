interface ISignBase {
  domain: {
    name: string;
    version: string;
    chainId: number;
  };
  typedData: {
    types: {
      Message: { name: string; type: string }[];
    };
    primaryType: string;
    domain: {
      name: string;
      version: string;
      chainId: number;
    };
    message: {
      [key: string]: string | number;
    };
  };
}
export {
  ISignBase
}