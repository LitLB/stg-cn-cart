// cart/src/types/http-errors.d.ts

import { HttpError } from 'http-errors';

declare module 'http-errors' {
    interface HttpError {
        errorCode?: string;
        data?: any;
    }
}