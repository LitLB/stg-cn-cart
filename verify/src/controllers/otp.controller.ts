import { NextFunction, Request, Response } from "express";
import { OtpService } from "../services/otp.service";
import { HTTP_MESSAGE, HTTP_STATUSES } from "../constants/http.constant";
import { checkCustomerProfileRequest, verifyOtpRequest } from "../interfaces/otp.interface";
import { createLogModel, LogModel } from "../utils/logger.utils";
import { LOG_APPS } from "../constants/log.constant";
import moment from "moment";

export class OtpController {
    private readonly otpService: OtpService;

    constructor() {
        this.otpService = new OtpService();
        this.requestOtp = this.requestOtp.bind(this);
        this.verifyOtp = this.verifyOtp.bind(this);
        this.getCustomerProfile = this.getCustomerProfile.bind(this);
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

        } catch (err: any) {

            next(err);
        }
    }

    public async verifyOtp(req: Request, res: Response, next: NextFunction) {
        const logModel = createLogModel(LOG_APPS.STORE_WEB, "");
        logModel.start_date = moment().toISOString()
        LogModel.initialize(logModel);
        try {

            const { mobileNumber, refCode, pin, journey }: verifyOtpRequest = req.query as unknown as verifyOtpRequest;
            const { sourcesystemid, correlatorid, sessionid } = req.headers


            await this.otpService.verifyOtp(mobileNumber, refCode, pin, journey, sourcesystemid as string, correlatorid as string, sessionid as string);

            res.status(200).send({
                statusCode: HTTP_STATUSES.OK,
                statusMessage: HTTP_MESSAGE.OK,
            });

        } catch (err: any) {
            next(err);
        }
    }

    public async getCustomerProfile(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        const logModel = createLogModel(LOG_APPS.STORE_WEB, "");
        logModel.start_date = moment().toISOString();
        LogModel.initialize(logModel);

        try {
            const { mobileNumber, journey } = req.query as unknown as checkCustomerProfileRequest;

            const { correlatorId } = req.headers

            const responseBody = await this.otpService.getCustomerProfile(correlatorId as string, mobileNumber, journey);

            res.status(200).json({
                statusCode: HTTP_STATUSES.OK,
                statusMessage: HTTP_MESSAGE.OK,
                data: responseBody
            });
        } catch (err) {
            next(err);
        }
    }
}