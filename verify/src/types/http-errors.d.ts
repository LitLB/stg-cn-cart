declare module 'http-errors' {
    interface HttpError {
        errorCode?: string;
        data?: any;
    }
}