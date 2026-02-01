export class InvokeServiceArgs {
    sender?: string;
    operation!: string;
    requestData: any;
    responseHandler?: ResponseHandler;
    controller?: string;
    fetchApiUrl?: string;
    httpMethod?: string;
    headers?: any;
}

export interface ResponseHandler {
    success: (response: any) => void;
    error: (error: any) => void;
}