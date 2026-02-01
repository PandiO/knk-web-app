import { serviceCall } from "../services/serviceCall";
import { logging } from "../utils";
import ConfigurationHelper from "../utils/config-helper";
import { InvokeServiceArgs } from "./interfaces";

export class ObjectManager {
    protected logger = logging.getLogger('ObjectManager');
    
    invokeServiceCall(data: any, operation: string, controller: string, httpMethod: string): Promise<any> {
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
                responseHandler: {
                    success: (result: any) => {
                        console.log(result);
                        resolve(result);
                        clearTimeout(timeoutId);
                    },
                    error: (err: any) => {
                        logging.errorHandler.next("ErrorMessage." + operation);
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