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
    appPort: process.env.APP_PORT as string,

    shutdownOnFatalError: process.env.SHUTDOWN_ON_FATAL_ERROR as string,

    clientId: process.env.CTP_CLIENT_ID as string,
    clientSecret: process.env.CTP_CLIENT_SECRET as string,
    projectKey: process.env.CTP_PROJECT_KEY as string,
    scope: process.env.CTP_SCOPE,
    region: process.env.CTP_REGION as string,

    bffCtpClientId: process.env.BFF_CTP_CLIENT_ID as string,
    bffCtpClientSecret: process.env.BFF_CTP_CLIENT_SECRET as string,

    ctpProjectKey: process.env.CTP_PROJECT_KEY as string,
    ctpAuthUrl: process.env.CTP_AUTH_URL as string,
    ctpApiUrl: process.env.CTP_API_URL as string,
    ctpClientId: process.env.CTP_CLIENT_ID as string,
    ctpClientSecret: process.env.CTP_CLIENT_SECRET as string,

    apigee: {
      baseUrl: process.env.APIGW_BASE_URL as string,
      clientId: process.env.APIGW_CLIENT_ID as string,
      clientSecret: process.env.APIGW_CLIENT_SECRET as string,
      privateKeyEncryption: process.env.APIGW_PRIVATE_KEY_ENCRYPTION as string,
    },
    otp: {
      expireTime: process.env.OTP_NUMBER_MINUTE_EXPIRE as string,
      resendTime: process.env.OTP_NUMBER_SECOND_RESEND as string,
      isMock: process.env.OTP_IS_MOCK as string,
      relatedPartyId: process.env.OTP_RELATED_PARTY_ID as string,
      relatedPartyHref: process.env.OTP_RELATED_PARTY_HREF as string,
    }
  };

  const validationErrors = getValidateMessages(envValidators, envVars);

  if (validationErrors.length) {
    throw new CustomError(
      'InvalidEnvironmentVariablesError',
      'Invalid Environment Variables please check your .env file',
      validationErrors
    );
  }

  return envVars;
};