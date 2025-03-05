import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { createApplicationLogger } from '@commercetools-backend/loggers';
import { LOG_CHANNEL, LOG_LEVELS, LOG_PRODUCT, LOG_RESULT_INDICATOR } from '../constants/log.constant';
import { safeStringify } from './formatter.utils';
import moment from 'moment';

export const logger = createApplicationLogger();

export function generateUUID(): string {
    return uuidv4();
}

interface LogModelRequest {
    app: string;
    channel: string;
    level?: string;
    msg?: string;
    product: string;
    request?: any;
    response?: any;
    result_code?: string;
    result_indicator?: string;
    start_date: string;
    timestamp?: string;
    txid?: string;
    step_txid?: string;
    workflow_id?: string;
    order_number?: string;
    url?: string;
}
export class LogModel {
    static instance: any;
    app: string;
    channel: string;
    level?: string;
    msg?: string;
    request?: any;
    response?: any;
    result_code?: string;
    result_indicator?: string;
    start_date: string;
    timestamp?: string;
    txid?: string;
    elapsed_time?: string | number;
    url?: string

    constructor(req: LogModelRequest) {
        this.app = req.app;
        this.channel = req.channel;
        this.level = req.level;
        this.msg = req.msg;
        this.request = req.request;
        this.response = req.response;
        this.result_code = req.result_code;
        this.result_indicator = req.result_indicator;
        this.start_date = req.start_date;
        this.timestamp = req.timestamp;
        this.txid = req.txid;
        this.url = req.url;
    }

    public static initialize(logModel: LogModel): void {
        LogModel.instance = logModel;
    }

    public static getInstance(): LogModel {
        if (!LogModel.instance) {
            throw new Error("LogModel has not been initialized. Call initialize() first.");
        }

        return LogModel.instance;
    }

    logSuccess(req: any, res: any, level?: string) {
        const status = _.get(res, 'status', null);
        const statusCode = _.get(res, 'statusCode', null);
        this.level = level ?? LOG_LEVELS.INFO;
        this.result_indicator = LOG_RESULT_INDICATOR.SUCCESS;
        this.request = req;
        this.response = res;
        this.result_code = (status || statusCode || '200').toString();
        this.timestamp = new Date().toISOString();
        this.elapsed_time = moment(moment().diff(moment(this.start_date))).milliseconds()


        logger.info(safeStringify(this));
    }

    logFailure(req: any, res: any) {
        const status = _.get(res, 'status', null);
        const statusCode = _.get(res, 'statusCode', null);
        this.level = LOG_LEVELS.ERROR;
        this.result_indicator = LOG_RESULT_INDICATOR.UNSUCCESS;
        this.request = req;
        this.response = res;
        this.result_code = (status || statusCode || '500').toString();
        this.timestamp = new Date().toISOString();
        this.elapsed_time = moment(moment().diff(moment(this.start_date))).milliseconds()

        logger.error(safeStringify(this));
    }
}

export function logService(req: any, res: any, l: LogModel) {
    try {

        const status = _.get(res, 'status', null);
        const statusCode = _.get(res, 'statusCode', null);
        const resCode = _.get(res, 'code', null);
        const respCode = status || statusCode;

        if (resCode == '0' || respCode == '200' || respCode == '201' || respCode == '204') {
            l.logSuccess(req, res, l.level || LOG_LEVELS.INFO);
        } else {
            const errResp = res?.response?.data || res;

            l.logFailure(req, errResp);
        }
    } catch (error: any) {
        logger.error(`Error in logService: ${error.stack}`);
    }
}

export function createLogModel(app: string, msg: string, instLogModel?: LogModel): LogModel {
    let logRequest: LogModelRequest;

    if (instLogModel) {
        logRequest = {
            app: app,
            channel: LOG_CHANNEL,
            msg: msg ?? "",
            product: LOG_PRODUCT,
            start_date: new Date().toISOString(),
            txid: instLogModel.txid,
            step_txid: generateUUID(),
        };
    } else {
        const uuid = generateUUID();
        logRequest = {
            app: app,
            channel: LOG_CHANNEL,
            msg: msg ?? "",
            product: LOG_PRODUCT,
            start_date: new Date().toISOString(),
            txid: uuid,
            step_txid: uuid,
        };
    }

    return new LogModel(logRequest);
}