export interface ApiResponse {
    status: number;
    statusCode: string;
    statusMessage: string;
    errorCode?: string;
    message?: string;
    data?: any;
}