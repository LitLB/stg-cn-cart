import CustomError from '../errors/custom.error';
import envValidators from '../validators/env.validators';
import { getValidateMessages } from '../validators/helpers.validators';

/**
 * Read the configuration env vars
 * (Add yours accordingly)
 *
 * @returns The configuration with the correct env vars
 */
export const readConfiguration = () => {
    const envVars = {
        appEnv: process.env.APP_ENV as string,
        isDisabledCron: process.env.DISABLE_CRON === 'true',
        clientId: process.env.CTP_CLIENT_ID as string,
        clientSecret: process.env.CTP_CLIENT_SECRET as string,
        projectKey: process.env.CTP_PROJECT_KEY as string,
        scope: process.env.CTP_SCOPE,
        region: process.env.CTP_REGION as string,

        // COMMERCE TOOLS
        ctpAuthUrl: process.env.CTP_AUTH_URL as string,
        ctpApiUrl: process.env.CTP_API_URL as string,
        ctpTaxCategoryId: process.env.CTP_TAX_CATEGORY_ID as string,
        ctpSupplyChannel: process.env.CTP_SUPPLY_CHANNEL_ID as string,
        bffCtpClientId: process.env.BFF_CTP_CLIENT_ID as string,
        bffCtpClientSecret: process.env.BFF_CTP_CLIENT_SECRET as string,

        dynamodb: {
            region: process.env.AWS_REGION,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        apigee: {
            baseUrl: process.env.APIGW_BASE_URL as string,
            clientId: process.env.APIGW_CLIENT_ID as string,
            clientSecret: process.env.APIGW_CLIENT_SECRET as string,
            privateKeyEncryption: process.env.APIGW_PRIVATE_KEY_ENCRYPTION as string,
        },
        tsmOrder: {
            shopCode: process.env.TSM_ORDER_SHOP_CODE as string,
            saleCode: process.env.TSM_ORDER_SALE_CODE as string,
            saleName: process.env.TSM_ORDER_SALE_NAME as string,
        }
    }

    const validationErrors = getValidateMessages(envValidators, envVars)

    if (validationErrors.length) {
        throw new CustomError(
            'InvalidEnvironmentVariablesError',
            'Invalid Environment Variables please check your .env file',
            validationErrors
        )
    }

    return envVars
}