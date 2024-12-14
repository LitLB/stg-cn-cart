// cart/src/interfaces/response.interface.ts

export interface ApiResponse<T = any> {
    statusCode: number;
    statusMessage: string;
    errorCode?: string;
    message?: string;
    data?: T;
}