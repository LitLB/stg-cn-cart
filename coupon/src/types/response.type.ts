export interface ApiResponse {
    statusCode: number;
    statusMessage: string;
    errorCode?: string;
    message?: string;
    data?: any;
}