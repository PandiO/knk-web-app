import { serviceCall } from '../services/serviceCall';
import ConfigurationHelper from '../utils/config-helper';
import { logging } from '../utils/logging';
import { BehaviorSubject } from 'rxjs';
import { InvokeServiceArgs } from './interfaces';
import { HttpMethod, Controllers, ItemOperation } from '../utils';
import { ObjectManager } from './objectManager';

export interface ApiItem {
    getAll(data: any): Promise<any[]>;
    getItemById(data: any): Promise<any>;
    createItem(data: any): Promise<any>;
    updateItem(data: any): Promise<any>;
}

export class ItemsManager extends ObjectManager implements ApiItem {
    private static instance: ItemsManager;

    public static getInstance() {
        if (!ItemsManager.instance) {
            ItemsManager.instance = new ItemsManager();
            ItemsManager.instance.logger = logging.getLogger('ItemsManager');  
        }

        return ItemsManager.instance;
    }

    getAll(data?: any): Promise<any[]> {
        return this.invokeServiceCall(data, ItemOperation.GetAll, Controllers.Items, HttpMethod.Get);
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

    // invokeServiceCall(data: any, operation: string, controller: string, httpMethod: string): Promise<any> {
    //     return new Promise((resolve, reject) => {
    //         const timeoutId = setTimeout(() => {
    //             reject(new Error("promise timeout"))
    //         }, (15*1000));
    //         const args: InvokeServiceArgs = {
    //             operation: operation,
    //             controller: controller,
    //             httpMethod: httpMethod,
    //             fetchApiUrl: ConfigurationHelper.gatewayApiUrl,
    //             requestData: data,
    //             responseHandler: {
    //                 success: (result: any) => {
    //                     resolve(result);
    //                     clearTimeout(timeoutId);
    //                 },
    //                 error: (err: any) => {
    //                     logging.errorHandler.next("ErrorMessage." + operation);
    //                     this.logger.error(err);
    //                     reject(err);
    //                     clearTimeout(timeoutId);
    //                 }
    //             }
    //         };

    //         serviceCall.invokeApiService(args);
    //     });
    // }
}

export const itemsManager = ItemsManager.getInstance();