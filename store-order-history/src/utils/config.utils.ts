import CustomError from '../errors/custom.error'
import envValidators from '../validators/env.validators'
import { getValidateMessages } from '../validators/helpers.validators'

/**
 * Read the configuration env vars
 * (Add yours accordingly)
 *
 * @returns The configuration with the correct env vars
 */
export const readConfiguration = () => {
    const envVars = {
        appEnv: process.env.APP_ENV as string,
        clientId: process.env.CTP_CLIENT_ID as string,
        clientSecret: process.env.CTP_CLIENT_SECRET as string,
        projectKey: process.env.CTP_PROJECT_KEY as string,
        scope: process.env.CTP_SCOPE,
        region: process.env.CTP_REGION as string,
        ctpAuthUrl: process.env.CTP_AUTH_URL as string,
        ctpApiUrl: process.env.CTP_API_URL as string,
        dynamodb: {
            region: process.env.AWS_REGION,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
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

export const talonOneConfig = () => {
    return {
        url: process.env.TALON_ONE_URL as string,
        apiKey: process.env.TALON_ONE_API_KEY as string,
        apiKeyPrefix: process.env.TALON_ONE_API_KEY_PREFIX as string,
        catalogId: Number(process.env.TALON_ONE_CATALOG_ID),
    }
}
