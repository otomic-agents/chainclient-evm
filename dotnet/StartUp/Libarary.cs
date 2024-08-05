using System;
using System.Net.Http;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using System.Threading;
public class Startup
{
    private static int _requestId = 1;
    public async Task<object> Invoke(dynamic input)
    {
        string rpcUrl = input.rpcUrl;//"https://mainnet.optimism.io";// input.rpcUrl;
        // Increment the requestId and handle overflow.
        Interlocked.Increment(ref _requestId);
        if (_requestId > int.MaxValue)
        {
            _requestId = 1;
        }
        return await Task.Run(() =>
        {
            // Edge.Fun()
            var httpClient = new HttpClient();
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
        });
    }
}
