import { serviceCall, ServiceCall } from "../services/serviceCall";
import { Controllers, HttpMethod, logging, StructuresOperation } from "../utils";
import ConfigurationHelper from "../utils/config-helper";
import { InvokeServiceArgs } from "./interfaces";
import { ApiItem } from "./items";

export class StructuresManager implements ApiItem {
    private static instance: StructuresManager;
    private readonly logger  = logging.getLogger('StructuresManager');

    public static getInstance() {
        if (!StructuresManager.instance) {
            StructuresManager.instance = new StructuresManager();
        }

        return StructuresManager.instance;
    }

    getAll(data?: any): Promise<any[]> {
        return this.invokeServiceCall(data, StructuresOperation.GetAll, Controllers.Structures, HttpMethod.Get);
    }
    getItemById(data: any): Promise<any> {
        throw new Error('Method not implemented.');
    }
    createItem(data: any): Promise<any> {
        throw new Error('Method not implemented.');
    }
    updateItem(data: any): Promise<any> {
        throw new Error('Method not implemented.');
    }

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

export const structuresManager = StructuresManager.getInstance();