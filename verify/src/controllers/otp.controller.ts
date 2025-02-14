import { NextFunction, Request, Response } from "express";
import { OtpService } from "../services/otp.service";
import { createLogModel, logger, LogModel, logService } from "../utils/logger.utils";
import { HTTP_MESSAGE, HTTP_STATUSES } from "../constants/http.constant";
import { LOG_APPS } from "../constants/log.constant";

export class OtpController {
    private readonly otpService: OtpService;

    constructor() {
        this.otpService = new OtpService();
        this.requestOtp = this.requestOtp.bind(this);
        this.verifyOtp = this.verifyOtp.bind(this);
    }

    public async requestOtp(req: Request, res: Response, next: NextFunction) {
        const logModel = createLogModel(LOG_APPS.VERIFY);
        logModel.start_date = new Date().toISOString();

        try {

            LogModel.initialize(logModel);

            const { mobileNumber } = req.query;

            if (!mobileNumber || typeof mobileNumber !== "string") {
                return res.status(400).send({
                    statusCode: "400",
                    statusMessage: "Mobile number is required and must be a string",
                });
            }

            const responseBody = await this.otpService.requestOtp(mobileNumber);


            res.status(200).send({
                statusCode: HTTP_STATUSES.OK,
                statusMessage: HTTP_MESSAGE.OK,
                data: responseBody
            });



        } catch (err) {
            logService(req, err, logModel);
            next(err);
        }
    }

    public async verifyOtp(req: Request, res: Response, next: NextFunction) {
        const logModel = createLogModel(LOG_APPS.VERIFY);
        logModel.start_date = new Date().toISOString();
        try {

            LogModel.initialize(logModel);
            const { mobileNumber, refCode, pin } = req.query;

            const responseBody = await this.otpService.verifyOtp(mobileNumber as string, refCode as string, pin as string);

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