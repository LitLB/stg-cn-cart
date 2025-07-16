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
    appEnv: process.env.APP_ENV as string,
    shutdownOnFatalError: process.env.SHUTDOWN_ON_FATAL_ERROR as string,

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
    ctpAddCustomOtherPaymentLineItemPrefix: process.env.CTP_ADD_CUSTOM_OTHER_PAYMENT_LINE_ITEM_PREFIX as string,
    ctpTaxCategoryId: process.env.CTP_TAX_CATEGORY_ID as string,

    bffCtpClientId: process.env.BFF_CTP_CLIENT_ID as string,
    bffCtpClientSecret: process.env.BFF_CTP_CLIENT_SECRET as string,


    ctpDefaultCouponLimit: process.env.CTP_DEFAULT_COUPON_LIMIT as string,

    onlineChannel: process.env.ONLINE_CHANNEL as string,
    ctpSupplyChannel: process.env.CTP_SUPPLY_CHANNEL_ID as string,

    ctPriceCustomerGroupIdRrp: process.env.CT_PRICE_CUSTOMER_GROUP_ID_RRP as string,

    t1: {
      apiKey: process.env.T1_API_KEY as string,
      prefixApiKey: process.env.T1_API_KEY_PREFIX as string,
      basePath: process.env.T1_URL as string,
    },
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
    },
    headless: {
      baseUrl: process.env.HEADLESS_BASE_URL as string,
    },
    hl: {
      baseUrl: process.env.HL_BASE_URL as string,
      apiKey: process.env.HL_API_KEY as string,
      timeout: process.env.HL_TIMEOUT ? parseInt(process.env.HL_TIMEOUT) : 30000,
      maxRetries: process.env.HL_MAX_RETRIES ? parseInt(process.env.HL_MAX_RETRIES) : 0,
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