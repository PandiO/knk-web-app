import { InvokeServiceArgs } from "../apiClients/interfaces";
import ConfigurationHelper from "../utils/config-helper";
import { HttpMethod } from "../utils/enums";
import { tokenService } from "../utils/tokenService";

/**
 * A readable message for a failed response. Many controllers answer a rule violation with
 * BadRequest(ex.Message) - a plain-text body - which used to be dropped in favour of
 * "HTTP 400: Bad Request", hiding the actual reason (e.g. the siege API's "A team without a clan
 * needs a name, a chat colour and a banner."). ProblemDetails bodies contribute detail/title and
 * their first validation error.
 */
export const describeErrorBody = (result: any, status: number, statusText: string): string => {
    const fallback = `HTTP ${status}: ${statusText}`;
    if (typeof result === 'string') {
        const text = result.trim();
        return text.length > 0 && text.length <= 500 && !text.startsWith('<') ? text : fallback;
    }
    if (result && typeof result === 'object') {
        if (typeof result.message === 'string' && result.message) return result.message;
        if (typeof result.detail === 'string' && result.detail) return result.detail;
        const firstValidationError = result.errors && typeof result.errors === 'object'
            ? Object.values(result.errors).flat().find((e: unknown) => typeof e === 'string')
            : undefined;
        if (typeof firstValidationError === 'string') return firstValidationError;
        if (typeof result.title === 'string' && result.title) return result.title;
    }
    return fallback;
};

export class ServiceCall {

    invokeService(_args: InvokeServiceArgs) {
        
    }

    public async invokeApiService(args: InvokeServiceArgs) {
        let baseUrl = ConfigurationHelper.gatewayApiUrl;
        if (args.fetchApiUrl) {
            baseUrl = args.fetchApiUrl;
        }

        let url = `${baseUrl}/${args.controller}`;

        const authToken = tokenService.getAccessToken();

        let requestParams: any = {
            method: args.httpMethod,
            credentials: 'include', // Include cookies for cross-origin requests (needed for refresh token)
            headers:  {
                'Accept': '*/*',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
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

        if (args.httpMethod === HttpMethod.Get) {
            if (args.requestData) {
                try {
                    const queryString = Object.keys(args.requestData).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(args.requestData[key])}`).join('&');
                    url = `${url}?${queryString}`;
                } catch (ex) {
                    console.log((ex as any).ErrorMessage);
                }
            }
        } else if (args.httpMethod === HttpMethod.Delete) {} else{
            requestParams = {
                method: args.httpMethod,
                credentials: 'include', // Include cookies for cross-origin requests (needed for refresh token)
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
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

            // Handle APIs that return no content (204) without throwing on response.json()
            let result: any = null;
            if (response.status !== 204) {
                const contentType = response.headers.get('content-type') || '';
                const isJson = contentType.includes('application/json');

                if (isJson) {
                    result = await response.json();
                } else {
                    const text = await response.text();
                    result = text?.length ? text : null;
                }
            }

            if (response.ok) {
                if (args.responseHandler) {
                    args.responseHandler.success(result);
                }
            } else {
                console.error(`[ServiceCall] HTTP ${response.status} error for ${args.controller}/${args.operation}:`, result);
                if (args.responseHandler) {
                    const error = new Error(describeErrorBody(result, response.status, response.statusText));
                    (error as any).response = result;
                    (error as any).status = response.status;
                    console.error('[ServiceCall] Calling error handler with:', error);
                    args.responseHandler.error(error);
                } else {
                    throw new Error(describeErrorBody(result, response.status, response.statusText));
                }
            }
        } catch (ex) {
            args.responseHandler?.error(ex);
        }

    }
}

export const serviceCall = new ServiceCall();