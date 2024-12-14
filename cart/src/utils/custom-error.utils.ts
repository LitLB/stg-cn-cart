// cart/src/utils/custom-error.utils.ts

export class CustomError extends Error {
    public statusCode: number;
    public errorCode?: string;
    public data?: any;

    constructor(statusCode: number, statusMessage: string, errorCode?: string, data?: any) {
        super(statusMessage);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.data = data;

        Object.setPrototypeOf(this, CustomError.prototype);
    }
}