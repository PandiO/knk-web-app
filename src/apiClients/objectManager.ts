import { serviceCall } from "../services/serviceCall";
import { logging } from "../utils";
import ConfigurationHelper from "../utils/config-helper";
import { InvokeServiceArgs } from "./interfaces";

/**
 * The toast for a failed request, or null when the caller handles it (X-1, KNG-141). Every 4xx is
 * the caller's: validation (400), session (401, refreshed by serviceCall), permission probes (403,
 * e.g. useStaffAccess on every page), not found (404) and conflicts (409). A network failure or a
 * server error is shown, since most callers only log those.
 */
export const requestFailureToast = (err: unknown, controller: string): string | null => {
    const status = (err as { status?: number } | null)?.status;
    if (status === undefined) {
        return "Can't reach the server. Check your connection and try again.";
    }
    if (status >= 500) {
        return `The server had a problem (${controller || 'request'}). Please try again.`;
    }
    return null;
};

export class ObjectManager {
    protected logger = logging.getLogger('ObjectManager');
    
    invokeServiceCall(data: any, operation: string, controller: string, httpMethod: string, headers?: Record<string, string>): Promise<any> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error("promise timeout"))
            }, (15*1000));
            const args: InvokeServiceArgs = {
                operation: operation,
                controller: controller,
                httpMethod: httpMethod,
                fetchApiUrl: ConfigurationHelper.gatewayApiUrl,
                requestData: data,
                headers,
                responseHandler: {
                    success: (result: any) => {
                        resolve(result);
                        clearTimeout(timeoutId);
                    },
                    error: (err: any) => {
                        const toast = requestFailureToast(err, controller);
                        if (toast) {
                            logging.errorHandler.next(toast);
                        }
                        this.logger.error(err);
                        reject(err);
                        clearTimeout(timeoutId);
                    }
                }
            };
            serviceCall.invokeApiService(args);
        });
    }
}