import { NextFunction, Request, Response } from "express";
import { OtpService } from "../services/otp.service";
import { HTTP_MESSAGE, HTTP_STATUSES } from "../constants/http.constant";
import { verifyOtpRequest } from "../interfaces/otp.interface";
import { createLogModel, LogModel, logService } from "../utils/logger.utils";
import { LOG_APPS, LOG_MSG } from "../constants/log.constant";
import moment from "moment";
import { EXCEPTION_MESSAGES } from "../constants/messages.constant";

export class OtpController {
    private readonly otpService: OtpService;

    constructor() {
        this.otpService = new OtpService();
        this.requestOtp = this.requestOtp.bind(this);
        this.verifyOtp = this.verifyOtp.bind(this);
    }

    public async requestOtp(req: Request, res: Response, next: NextFunction) {
        const logModel = createLogModel(LOG_APPS.STORE_WEB, "");
        logModel.start_date = moment().toISOString()
        LogModel.initialize(logModel);
        try {
            const { mobileNumber } = req.query;

            if (!mobileNumber || typeof mobileNumber !== 'string') {
                return res.status(400).send({
                    statusCode: HTTP_STATUSES.BAD_REQUEST,
                    statusMessage: 'Invalid mobile number',
                    errorCode: 'INVALID_MOBILE_NUMBER',
                })
            }

            const responseBody = await this.otpService.requestOtp(mobileNumber);


            res.status(200).send({
                statusCode: HTTP_STATUSES.OK,
                statusMessage: HTTP_MESSAGE.OK,
                data: responseBody
            });


        } catch (error: any) {

            next(error);
        }
    }

    public async verifyOtp(req: Request, res: Response, next: NextFunction) {
        const logModel = createLogModel(LOG_APPS.STORE_WEB, "");
        logModel.start_date = moment().toISOString()
        LogModel.initialize(logModel);
        try {

            const { mobileNumber, refCode, pin, journey }: verifyOtpRequest = req.query as unknown as verifyOtpRequest;

            const responseBody = await this.otpService.verifyOtp(mobileNumber, refCode, pin, journey);

            res.status(200).send({
                statusCode: HTTP_STATUSES.OK,
                statusMessage: HTTP_MESSAGE.OK,
                data: responseBody
            });
        } catch (err: any) {
            next(err);
        }
    }
}