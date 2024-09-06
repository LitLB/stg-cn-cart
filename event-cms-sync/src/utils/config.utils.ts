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
    clientId: process.env.CTP_CLIENT_ID as string,
    clientSecret: process.env.CTP_CLIENT_SECRET as string,
    projectKey: process.env.CTP_PROJECT_KEY as string,
    scope: process.env.CTP_SCOPE,
    region: process.env.CTP_REGION as string
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

export const contentStackConfig = () => {
  return {
    url: process.env.CS_BASE_URL as string,
    api_key: process.env.CS_API_KEY as string,
    authorization: process.env.CS_AUTHORIZATION as string,
    environments: [process.env.CS_ENVIRONMENRS] as any,
    branch: process.env.CS_BRANCH as string,
    content_type_uid: process.env.CS_CONTENT_TYPE_UID as string
  }
}
