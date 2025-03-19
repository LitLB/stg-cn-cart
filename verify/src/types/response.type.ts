export interface ApiResponse {
    statusCode: string;
    statusMessage: string;
    errorCode?: string;
    message?: string;
    data?: any;
}