// cart/src/types/express.d.ts

import { Cart } from '@commercetools/platform-sdk';
import { Request } from 'express-serve-static-core';

declare module 'express-serve-static-core' {
    interface Request {
        accessToken?: string;
        cart?: Cart
    }
}