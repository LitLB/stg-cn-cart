import { NextFunction, Request, Response } from "express";
import { OtpService } from "../services/otp.service";
import { HTTP_MESSAGE, HTTP_STATUSES } from "../constants/http.constant";
import { checkCustomerProfileRequest, verifyOtpRequest } from "../interfaces/otp.interface";
import { createLogModel, LogModel } from "../utils/logger.utils";
import { LOG_APPS } from "../constants/log.constant";
import moment from "moment";
import { CustomerVerifyQueryParams } from "../interfaces/verify.interface";
import { ApiResponse } from "../types/response.type";

export class OtpController {
    private readonly otpService: OtpService;

    constructor() {
        this.otpService = new OtpService();
        this.requestOtp = this.requestOtp.bind(this);
        this.verifyOtp = this.verifyOtp.bind(this);
        this.getPackageOffer = this.getPackageOffer.bind(this);
        this.handleCustomerVerification = this.handleCustomerVerification.bind(this);
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

            await this.otpService.verifyOtp(mobileNumber, refCode, pin, journey);

            res.status(200).send({
                statusCode: HTTP_STATUSES.OK,
                statusMessage: HTTP_MESSAGE.OK,
            });

        } catch (err: any) {
            next(err);
        }
    }

    public async getPackageOffer(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        const logModel = createLogModel(LOG_APPS.STORE_WEB, "PackageOffer");
        logModel.start_date = moment().toISOString();
        LogModel.initialize(logModel);

        try {
            const { mobileNumber, journey } = req.query as unknown as checkCustomerProfileRequest;

            const { correlatorid } = req.headers

            const responseBody = await this.otpService.getCustomerTier(correlatorid as string, mobileNumber, journey)


            res.status(200).json({
                statusCode: HTTP_STATUSES.OK,
                statusMessage: HTTP_MESSAGE.OK,
                data: responseBody
            });
        } catch (err) {
            next(err);
        }
    }

    public async handleCustomerVerification(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        const logModel = createLogModel(LOG_APPS.STORE_WEB, "");
        logModel.start_date = moment().toISOString();
        LogModel.initialize(logModel);

        try {
            const { correlatorid } = req.headers;

            const customerVerification = await this.otpService.handleCustomerVerification(
                correlatorid as string,
                req.query as unknown as CustomerVerifyQueryParams,
            );

            const response: ApiResponse = {
                statusCode: String(HTTP_STATUSES.OK),
                statusMessage: HTTP_MESSAGE.OK,
                data: customerVerification
            };

            res.status(HTTP_STATUSES.OK).json(response);
        } catch (err: any) {
            next(err);
        }
    }
}