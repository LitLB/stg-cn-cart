export interface ResponseType {
    statusCode: number;
    statusMessage: string;
    errorCode?: string;
    message?: string;
    data?: any;
}