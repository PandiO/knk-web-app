import { InvokeServiceArgs } from "../io/interfaces";
import ConfigurationHelper from "../utils/config-helper";
import { HttpMethod } from "../utils/enums";

export class ServiceCall {

    invokeService(args: InvokeServiceArgs) {
        
    }

    public async invokeApiService(args: InvokeServiceArgs) {
        let baseUrl = ConfigurationHelper.gatewayApiUrl;
        if (args.fetchApiUrl) {
            baseUrl = args.fetchApiUrl;
        }

        let url = `${baseUrl}/${args.controller}`;

        let requestParams: any = {
            method: HttpMethod.Get,
            headers:  {
                'Accept': '*/*',
            }
        };

        if (args.httpMethod 
            // && args.httpMethod != HttpMethod.Post
            && args.operation
        ) {
            url = `${url}/${args.operation}`;
        }

        if (!args.httpMethod && args.requestData) {
            args.httpMethod = HttpMethod.Post;
        }

        if (!args.httpMethod) {
            args.httpMethod = HttpMethod.Get;
        }

        if (args.httpMethod == HttpMethod.Get) {
            if (args.requestData) {
                try {
                    const queryString = Object.keys(args.requestData).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(args.requestData[key])}`).join('&');
                    url = `${url}?${queryString}`;
                } catch (ex) {
                    console.log((ex as any).ErrorMessage);
                }
            }
        } else {
            requestParams = {
                method: args.httpMethod,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            };
        

            if (args.requestData) {
                requestParams.body = JSON.stringify(args.requestData);
            }
        }
        // requestParams = {
        //     method: args.httpMethod,
        //     headers: {
        //         'Accept': 'application/json',
        //         'Content-Type': 'application/json'
        //     }
        // };
    

        // if (args.requestData) {
        //     requestParams.body = JSON.stringify(args.requestData);
        // }

        try {
            console.log(url);
            console.log(requestParams);
            const response = await fetch(url, requestParams);
            const result = await response.json();

            if (response.ok) {
                if (args.responseHandler) {
                    args.responseHandler.success(result);
                }
            } else {
                if (args.responseHandler) {
                    args.responseHandler.error(result);
                }
            }
        } catch (ex) {
            args.responseHandler?.error(ex);
        }

    }
}

export const serviceCall = new ServiceCall();