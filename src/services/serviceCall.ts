import { InvokeServiceArgs } from "../apiClients/interfaces";
import ConfigurationHelper from "../utils/config-helper";
import { HttpMethod } from "../utils/enums";
import { tokenService } from "../utils/tokenService";
import { handleSessionExpired, refreshAccessToken } from "./sessionRefresh";

/**
 * Auth endpoints whose 401 means "wrong credentials" or "no session", not "access token expired":
 * they never trigger a refresh and retry. `me` is here because autoLogin refreshes on its own.
 */
const AUTH_OPERATIONS_WITHOUT_RETRY = new Set([
    'login', 'register', 'refresh', 'logout', 'forgot-password', 'reset-password', 'validate-token', 'me',
]);

export const isRetryableAfterRefresh = (controller?: string, operation?: string): boolean =>
    !(controller?.toLowerCase() === 'auth' && AUTH_OPERATIONS_WITHOUT_RETRY.has((operation ?? '').toLowerCase()));

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

        let body: string | undefined;
        const sendsJson = args.httpMethod !== HttpMethod.Get && args.httpMethod !== HttpMethod.Delete;
        if (args.httpMethod === HttpMethod.Get) {
            if (args.requestData) {
                try {
                    const queryString = Object.keys(args.requestData).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(args.requestData[key])}`).join('&');
                    url = `${url}?${queryString}`;
                } catch {
                    // Leave the URL without a query string; never log the request data.
                }
            }
        } else if (sendsJson && args.requestData) {
            body = JSON.stringify(args.requestData);
        }

        // Built per attempt, so a retry after a refresh carries the new access token. Cookies
        // (the HttpOnly refresh cookie on /api/Auth) always go along.
        const buildRequest = (authToken: string | null): RequestInit => ({
            method: args.httpMethod,
            credentials: 'include',
            headers: sendsJson
                ? {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    // e.g. Idempotency-Key on currency writes (see ObjectManager.invokeServiceCall)
                    ...(args.headers ?? {})
                }
                : {
                    'Accept': '*/*',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                },
            ...(body !== undefined ? { body } : {}),
        });

        try {
            const sentToken = tokenService.getAccessToken();
            let response = await fetch(url, buildRequest(sentToken));

            // An expired access token: refresh once (shared with every other 401 in flight) and
            // retry. Only for requests that carried a token - an anonymous 401 has nothing to renew.
            if (response.status === 401 && sentToken && isRetryableAfterRefresh(args.controller, args.operation)) {
                const currentToken = tokenService.getAccessToken();
                const renewed = currentToken && currentToken !== sentToken
                    ? true // another request already refreshed while this one was in flight
                    : await refreshAccessToken();
                if (renewed) {
                    response = await fetch(url, buildRequest(tokenService.getAccessToken()));
                } else {
                    handleSessionExpired();
                }
            }

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
                // Status and controller only: the URL, headers and bodies can hold tokens, link codes
                // or emails.
                console.error(`[ServiceCall] HTTP ${response.status} from ${args.controller ?? 'api'}`);
                const error = new Error(describeErrorBody(result, response.status, response.statusText));
                (error as any).response = result;
                (error as any).status = response.status;
                // The API's `{ error, message }` code (InvalidCredentials, TooManyAttempts, ...).
                if (result && typeof result === 'object' && typeof result.error === 'string') {
                    (error as any).code = result.error;
                }
                const retryAfter = response.headers.get('retry-after');
                if (retryAfter) {
                    (error as any).retryAfter = retryAfter;
                }
                if (args.responseHandler) {
                    args.responseHandler.error(error);
                } else {
                    throw error;
                }
            }
        } catch (ex) {
            args.responseHandler?.error(ex);
        }

    }
}

export const serviceCall = new ServiceCall();
