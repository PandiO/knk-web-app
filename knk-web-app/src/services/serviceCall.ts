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

        let url = `${baseUrl}/${args.controller}/${args.operation}`;

        let requestParams: any = {
            method: HttpMethod.Get,
            headers:  {
                'Accept': '*/*',
            }
        };

        if (!args.httpMethod && args.requestData) {
            args.httpMethod = HttpMethod.Post;
        }

        if (!args.httpMethod) {
            args.httpMethod = HttpMethod.Get;
        }

        if (args.httpMethod == HttpMethod.Get) {
            if (args.requestData) {
                const queryString = Object.keys(args.requestData).map(key => key + '=' + args.requestData[key].join('&'));
                url = `${url}?${queryString}`
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

        try {
            console.log(url);
            const response = await fetch(url, requestParams);
            const result = await response.json();

            if (args.responseHandler) {
                args.responseHandler.success(result);
            }
        } catch (ex) {

        }

    }
}

export const serviceCall = new ServiceCall();