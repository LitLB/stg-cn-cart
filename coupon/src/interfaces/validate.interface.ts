// cart/src/interfaces/validate.interface.ts

import { Schema } from "joi";

export interface ValidationSchemas {
    body?: Schema;
    query?: Schema;
    params?: Schema;
}
