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
    region: process.env.CTP_REGION as string,

    ctpProjectKey: process.env.CTP_PROJECT_KEY as string,
    ctpAuthUrl: process.env.CTP_AUTH_URL as string,
    ctpApiUrl: process.env.CTP_API_URL as string,
    ctpClientId: process.env.CTP_CLIENT_ID as string,
    ctpClientSecret: process.env.CTP_CLIENT_SECRET as string,
    ctpAddCustomCouponLineItemPrefix: process.env.CTP_ADD_CUSTOM_COUPON_LINE_ITEM_PREFIX as string,
    ctpTaxCategoryId: process.env.CTP_TAX_CATEGORY_ID as string,

    bffCtpClientId: process.env.BFF_CTP_CLIENT_ID as string,
    bffCtpClientSecret: process.env.BFF_CTP_CLIENT_SECRET as string,

    ctpWholeCartLimit: process.env.CTP_WHOLE_CART_LIMIT as string,

    onlineChannel: process.env.ONLINE_CHANNEL as string,

    ctPriceCustomerGroupIdRrp: process.env.CT_PRICE_CUSTOMER_GROUP_ID_RRP as string,

    t1: {
      apiKey: process.env.T1_API_KEY as string,
      prefixApiKey: process.env.T1_API_KEY_PREFIX as string,
      basePath: process.env.T1_URL as string,
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

export const ETLConfig = () => {
  return {
    clientUrl: process.env.ETL_CLIENT_URL as string
  }
}