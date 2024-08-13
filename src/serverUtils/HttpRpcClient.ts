import axios, { AxiosRequestConfig } from 'axios';
import { UniqueIDGenerator } from '../utils/comm';
import https from 'https';
import * as _ from "lodash"
interface RequestArguments {
    method: string;
    params?: any[];
}

export class HttpRpcClient {
    private url: string;

    constructor(url: string) {
        this.url = url;
    }
    public getUrl(): string {
        return this.url;
    }
    public async request(requestObject: RequestArguments, timeout?: number): Promise<any> {
        const agent = new https.Agent({
            keepAlive: false,
        });
        const config: AxiosRequestConfig = {
            httpsAgent: agent,
            timeout: timeout || 5000, // Default timeout is 5 seconds
        };
        const { method, params } = requestObject;
        const payload = {
            jsonrpc: '2.0',
            method,
            params: params || [],
            id: UniqueIDGenerator.getNextID(), // Use current timestamp as ID for simplicity
        };

        try {
            const response = await axios.post(this.url, payload, config);
            // systemOutput.debug(`Rpc <- Id-${_.get(response, "data.id", undefined)}`)
            const error = _.get(response, "data.error", undefined)
            /**
                    jsonrpc: '2.0',
                    id: 34,
                    error: {
                        code: -32005,
                        message: 'limit exceeded'
                    }
             */
            if (error != undefined) {
                throw new Error(`Request failed with message: ${_.get(error, "message", "")}`)
            }
            const result = _.get(response, "data.result", undefined)
            if (!result || result == undefined) {
                throw new Error(`Request failed,result is empty ,status code: ${_.get(response, "status", 0)} ,response body ${_.get(response, "data")}`)
            }
            return result
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Request failed with status ${error.response?.status}: ${error.message}`);
            }
            throw error;
        }
    }

    // This is a dummy implementation since HTTP requests don't have connections to close.
    // In case of WebSocket or persistent connections, you might need to implement closing logic here.
    public close(): void {
        console.log('Closing the connection... (dummy implementation)');
    }
}