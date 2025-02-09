import { Controllers, HttpMethod, logging, StructuresOperation } from "../utils";
import { StructureCreateDTO } from "../utils/domain/dto/structure/StructureCreateDTO";
import { StructureViewDTO } from "../utils/domain/dto/structure/StructureViewDTO";
import { ObjectManager } from "./objectManager";

export class StructuresManager extends ObjectManager {
    private static instance: StructuresManager;

    public static getInstance() {
        if (!StructuresManager.instance) {
            StructuresManager.instance = new StructuresManager();
            StructuresManager.instance.logger = logging.getLogger('StructuresManager');
        }

        return StructuresManager.instance;
    }

    getAll(data?: any): Promise<any[]> {
        return this.invokeServiceCall(data, StructuresOperation.GetAll, Controllers.Structures, HttpMethod.Get);
    }

    create(data: StructureCreateDTO): Promise<any> {
        return this.invokeServiceCall(data, StructuresOperation.Create, Controllers.Structures, HttpMethod.Post);
    }

    getViewById(id: number): Promise<StructureViewDTO> {
        return this.invokeServiceCall({id: id}, StructuresOperation.GetViewById, Controllers.Structures, HttpMethod.Get);
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
    //                     console.log(result);
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

export const structuresManager = StructuresManager.getInstance();