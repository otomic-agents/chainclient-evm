using System;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using System.Threading;
public class Lib
{
  private static int _requestId = 1;
  public async Task<string> getGasPrice(dynamic input)
  {
    string rpcUrl = input.rpcUrl;
    Interlocked.Increment(ref _requestId);
    if (_requestId > int.MaxValue)
    {
      _requestId = 1;
    }
    // Edge.Fun()
    var httpClient = new HttpClient();
    httpClient.Timeout = TimeSpan.FromSeconds(3);

    var requestObject = new JObject(
            new JProperty("jsonrpc", "2.0"),
            new JProperty("method", "eth_gasPrice"),
            new JProperty("params", new JArray()),
            new JProperty("id", _requestId)
        );

    var content = new StringContent(requestObject.ToString(), System.Text.Encoding.UTF8, "application/json");
    HttpResponseMessage response = httpClient.PostAsync(rpcUrl, content).Result;
    if (!response.IsSuccessStatusCode)
    {
      throw new Exception($"Failed to fetch gas price: {response.StatusCode}");
    }
    var responseString = response.Content.ReadAsStringAsync().Result;
    return responseString;
  }
}
public class Startup
{
  Lib lib = new Lib();
  public async Task<object> Invoke(dynamic input)
  {
    return await Task.Run(async () =>
    {
      if (input.method == "getGasPrice")
      {
        return await this.lib.getGasPrice(input);
      }
      throw new Exception($"method not found..{input.method}");
    });
  }
}
