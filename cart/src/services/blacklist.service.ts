import { dynamoClient } from '../adapters/dynamodb-client';
import { formatError } from '../utils/error.utils';

interface ShippingAddress {
  city: string;
  district: string;
  postcode: string;
  subDistrict: string;
}

interface paymentCreditCardNumber {
  firstDigits: string;
  lastDigits: string;
}

interface BodyType {
  journey: string;
  email: string;
  deliveryContactNumber: string;
  deliveryContactName: string;
  paymentTMNAccountNumber?: string;
  paymentCreditCardNumber?: paymentCreditCardNumber;
  googleID?: string;
  ipAddress?: string;
  shippingAddress?: ShippingAddress;
}

interface BlacklistResponse {
  status: boolean;
  statusMessage?: string;
  type?: string;
}

export class BlacklistService {
  public checkBlacklist = async (
    body: BodyType
  ): Promise<BlacklistResponse> => {
    // Validate required fields
    const validateFields = (
      fields: string[],
      data: Record<string, any>,
      fieldName: string
    ): string[] => fields.filter((field) => !data?.[field]);

    const missingFields = validateFields(
      ['journey', 'email', 'deliveryContactNumber', 'deliveryContactName'],
      body,
      'body'
    );

    if (missingFields.length > 0) {
      return {
        status: false,
        statusMessage: `${missingFields.join(', ')} is require`,
      };
    }

    if (body.shippingAddress) {
      const missingShippingFields = validateFields(
        ['city', 'postcode', 'subDistrict', 'district'],
        body.shippingAddress,
        'shippingAddress'
      );

      if (missingShippingFields.length > 0) {
        return {
          status: false,
          statusMessage: `${missingShippingFields.join(
            ', '
          )} of shippingAddress is require`,
        };
      }
    }

    if (body.paymentCreditCardNumber) {
      const missingPaymentCreditCardNumberFields = validateFields(
        ['firstDigits', 'lastDigits'],
        body.paymentCreditCardNumber,
        'paymentCreditCardNumber'
      );

      if (missingPaymentCreditCardNumberFields.length > 0) {
        return {
          status: false,
          statusMessage: `${missingPaymentCreditCardNumberFields.join(
            ', '
          )} of paymentCreditCardNumber is require`,
        };
      }
    }

    // Set up DynamoDB query parameters
    const params = {
      tableName: 'true-ecommerce-blacklist-dev',
      indexName: 'active-journey-index',
      keyConditionExpression: '#active = :active',
      expressionAttributeNames: {
        '#active': 'active',
      },
      expressionAttributeValues: {
        ':active': { N: '1' },
      },
    };

    try {
      // Query DynamoDB
      const response = await dynamoClient.queryCommand(params);
      const items: any[] = response?.Items || [];
      const bodyJourneySet = new Set(body.journey.split('|'));

      for (const item of items) {
        const itemJourneys = item.journey?.S.split('|') || [];
        const hasMatchingJourney = itemJourneys.some((journey: string) =>
          bodyJourneySet.has(journey)
        );

        if (!hasMatchingJourney) continue;

        // Check shippingAddress separately
        if (item.type?.S === 'shippingAddress' && body.shippingAddress) {
          const itemShippingAddress = {
            city: item.value?.M?.city?.S || '',
            district: item.value?.M?.district?.S || '',
            postcode: item.value?.M?.postcode?.S || '',
            subDistrict: item.value?.M?.subDistrict?.S || '',
          };

          if (
            body.shippingAddress.city === itemShippingAddress.city &&
            body.shippingAddress.district === itemShippingAddress.district &&
            body.shippingAddress.postcode === itemShippingAddress.postcode &&
            body.shippingAddress.subDistrict === itemShippingAddress.subDistrict
          ) {
            return {
              status: false,
              type: item.type.S,
            };
          }
          continue;
        }

        if (
          item.type?.S === 'paymentCreditCardNumber' &&
          body.paymentCreditCardNumber
        ) {
          const formattedCardNumber = `${body.paymentCreditCardNumber.firstDigits}xxxx${body.paymentCreditCardNumber.lastDigits}`;
          const itemPaymentCreditCardNumber = item.value?.S?.toLowerCase();
          if (formattedCardNumber === itemPaymentCreditCardNumber) {
            return {
              status: false,
              type: item.type.S,
            };
          }
          continue;
        }

        // Dynamically check other keys
        for (const key of Object.keys(body)) {
          if (key === 'shippingAddress') continue;

          if (body[key as keyof BodyType] === item.value?.S) {
            return {
              status: false,
              type: item.type?.S,
            };
          }
        }
      }

      // No matches found
      return {
        status: true,
      };
    } catch (error) {
      console.error('Error querying DynamoDB:', error);
      return {
        status: false,
        statusMessage: 'Internal Error',
      };
    }
  };
}
