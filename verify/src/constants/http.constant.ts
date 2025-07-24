
export enum HTTP_STATUSES {
    OK = 200,
    CREATED = 201,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    INTERNAL_SERVER_ERROR = 500,
}

export enum HTTP_MESSAGE {
    OK = 'Successfully processed',
    CREATED = 'Created',
    NO_CONTENT = 'No Content',
    BAD_REQUEST = 'Bad Request',
    UNAUTHORIZED = 'Unauthorized',
    FORBIDDEN = 'Forbidden',
    NOT_FOUND = 'Not Found',
    CONFLICT = 'Conflict',
    INTERNAL_SERVER_ERROR = 'Internal Server Error',
}

export enum STATUS_CODES {
    SUCCESSFULLY_PROCESSED = "200",                                 // Successfully processed
    INPUT_PARAMETER_BLANK_OR_INVALID = "400.1001",                  // Input parameter is blank or invalid
    UNAUTHORIZED_REQUEST = "401.1001",                              // Unauthorized
    INVALID_TOKEN = "401.1002",                                     // Invalid token
    RESULT_NOT_FOUND = "404.1001",                                  // Result not found
    METHOD_NOT_ALLOWED = "405.1001",                                // Method not allowed
    SQL_SYNTAX_ERROR = "500.1001",                                  // SQL syntax error
    DATABASE_CONNECTION_ERROR = "500.1002",                         // Database connection error
    DESTINATION_ERROR_400 = "500.1003",                             // Destination error, found HTTP status 400 - Bad request
    DESTINATION_ERROR_401 = "500.1004",                             // Destination error, found HTTP status 401 - Unauthorized
    DESTINATION_ERROR_404 = "500.1005",                             // Destination error, found HTTP status 404 - Not found
    DESTINATION_ERROR_500 = "500.1006",                             // Destination error, found HTTP status 500 - Internal Server Error
    DESTINATION_ERROR_502 = "500.1007",                             // Destination error, found HTTP status 502 - Bad Gateway
    DESTINATION_ERROR_503 = "500.1008",                             // Destination error, found HTTP status 503 - Service Unavailable
    REDIS_CONNECTION_ERROR = "500.1009",                            // Redis connection error (SA Doc also has "Destination error, found HTTP status 504 - Gateway Timeout" for 500.1009)
    ERROR_INSERTING_DATA_INTO_REDIS = "500.1010",                   // Error inserting data into Redis
    ERROR_UPDATING_DATA_INTO_REDIS = "500.1011",                    // Error updating data into Redis
    ERROR_RETRIEVING_DATA_FROM_REDIS = "500.1012",                  // Error retrieving data from Redis
    CONFIGURABLE_NOT_FOUND = "500.1013",                            // Configurable not found
    UNKNOWN_ERROR = "500.9999",                                     // Unknown error
    BAD_GATEWAY = "502.1001",                                       // Bad Gateway
    SERVER_MAINTENANCE = "503.1001",                                // Have maintenance of the server
    TCP_HTTP_BACKEND_CONNECTION_RESET = "504.1001",                 // TCP/HTTP backend service connection reset
    TCP_HTTP_BACKEND_CONNECTION_TIMEOUT = "504.1002",               // TCP/HTTP backend service connection timeout
    TCP_HTTP_BACKEND_SERVICE_ERROR = "504.1003",                    // TCP/HTTP backend service error

    // Specific Error Codes (from your "Specific Error Code" table)
    OTP_LIMIT_REACHED = "400.4001",                                 // OTP Limit Reached
    OTP_IS_NOT_MATCH = "400.4002",                                  // OTP is not match
    OTP_IS_NOT_MATCH_5_TIMES = "400.4003",                          // OTP is not match for 5 times
    OTP_HAS_EXPIRED = "400.4004",                                   // OTP has expired
    OPERATOR_NOT_TRUE_OR_DTAC = "400.4005",                         // Operator not TRUE or DTAC
    BLACKLISTED_CUSTOMER_NOT_ALLOWED = "400.4006",                  // Black listed customer is not allowed
    GET_CUSTOMER_TIER_FAIL = "400.4007",                            // Get customer tier fail
    GET_CONTRACT_FAIL = "400.4008",                                 // Get contract fail
    UNVERIFIED_OTP = "400.4009",                                    // Unverified OTP
    GET_PROFILE_INFO_FAIL = "400.4010",                             // Get profile info fail
    SUBSCRIBER_TYPE_NOT_POSTPAID = "400.4011",                      // Subscriber type is not postpaid
    UNVERIFIED_CUSTOMER = "400.4012",                               // Unverified customer
    NOT_ALLOWED_TO_EXTEND_CONTRACT = "400.4013",                    // Not allowed to extend contract
    OFFER_PACKAGE_NOT_FOUND = "400.4014",                           // Offer package not found
    GET_OFFER_PACKAGE_FAIL = "400.4015",                            // Get offer package fail
    GET_OPERATOR_FAIL = "400.4016",                                 // Get operator fail
    CUSTOMER_TYPE_NOT_ELIGIBLE = "400.4017",                        // Customer type is not eligible
    COMPANY_NOT_ALLOWED = "400.4018",                               // Company is not allow
    CUSTOMER_NOT_ACTIVE = "400.4019",                               // Customer is not active
    CUSTOMER_SUSPENDED = "400.4020",                                // Customer is suspended
    PACKAGE_IS_SHARE_PLAN = "400.4021",                             // Package is share plan
    GET_BLACKLISTED_FAIL = "400.4022",                              // Get black listed fail
    NUMBER_CANCELLED_OR_PREPAID_SWITCH = "400.4023",                 // This number requested service cancellation or switch from a postpaid to a prepaid plan
    GET_PRODUCT_FAIL = "400.4024",                                  // Get product fail
    GET_PACKAGE_FAIL = "400.4025",                                  // Get package fail
    PACKAGE_INFORMATION_INCORRECT = "400.4026",                     // Package information is incorrect
    CUSTOMER_JOURNEY_INCORRECT = "400.4027",                        // Customer journey is incorrect
    VERIFY_OTP_FAIL = "400.4028",                                   // Verify OTP fail
    GET_LIST_CONTRACT_FORM_FAIL = "400.4029",                       // Get list contract form fail
    GENERATE_CONTRACT_FORM_FAIL = "400.4030",                       // Generate contract form fail
    DOWNLOAD_CONTRACT_FORM_FILE_FAIL = "400.4031",                  // Download contract form file fail
    GET_ORDER_DETAIL_FAIL = "400.4032",                             // Get order detail fail
    GET_STANDALONE_PRICE_FAIL = "400.4033",                         // Get standalone price fail
    AGE_OF_USE_DOES_NOT_MEET_CRITERIA = "400.4034",                 // The age of use does not meet the required criteria
    GET_CUSTOMER_TYPE_FAIL = "400.4035",                            // Get customer type fail
    RESERVE_DEALER_NOT_FOUND = "400.4036",                          // Reserve Dealer not found
    BLOCK_NOT_ALLOCATED = "400.4037",                               // Block not allocated
    REACHED_MAXIMUM_RESERVATION = "400.4038",                       // Reached to maximum reservation
    MSISDN_HAS_BEEN_RESERVED = "400.4039",                          // MSISDN has been reserved
    MSISDN_NOT_ALLOCATED_FOR_DEALER_CODE = "400.4040",              // MSISDN not allocated for dealer code
    PROPOSITION_NOT_RELATED_WITH_POOL_NUMBER = "400.4041",          // Proposition is not related with pool number
    CUSTOMER_IN_COLLECTION = "400.4042",                            // Customer in collection
    CUSTOMER_FRAUD_FLAGGED = "400.4043",                            // Customer fraud flagged
    IDENTIFICATION_FORMAT_INVALID = "400.4044",                     // Identification format is invalid
    STATUS_OF_MSISDN_INVALID = "400.4045",                          // Status of MSISDN is invalid
    CONTENT_NOT_FOUND = "400.4046",                                 // Content not found
    GET_CONTENT_FAIL = "400.4047",                                  // Get content fail
    CERTIFICATION_ID_INVALID = "400.4048",                          // Certification ID is Invalid
    DATE_OF_BIRTH_INVALID = "400.4049",                             // Date of birth is Invalid
    VERIFY_DOPA_FAIL = "400.4050",                                  // Verify DOPA fail
    SUBMIT_PROVISIONING_FAIL = "400.4051",                          // Submit provisioning fail
    GET_CURRENT_IMEI_FAIL = "400.4052",                             // Get current IMEI fail
    CHANGE_IMEI_FAIL = "400.4053",                                  // Change IMEI fail
    GET_MAIN_PACKAGE_FAIL = "400.4054",                             // Get main package fail
    CHANGE_MAIN_PACKAGE_FAIL = "400.4055",                          // Change main package fail
    GET_SUPPLEMENTARY_PACKAGE_FAIL = "400.4056",                    // Get supplementary package fail
    CHANGE_SUPPLEMENTARY_PACKAGE_FAIL = "400.4057",                 // Change supplementary package fail
    ADD_CONTRACT_FAIL = "400.4058",                                 // Add contract fail
    VERIFY_HEADLESS_NON_COMMERCE_FAIL = "400.4059",                 // Verify headless non commerce fail
    INVALID_LOCK_3_STEP = "400.4060",                               // Invalid lock 3 step
    INVALID_ACTIVATED_LESS_THAN_45_DAYS = "400.4061",               // Invalid activated less than 45 days ago
    OVER_MAX_ALLOW_6_NUMBER = "400.4062",                           // Over max allow (6 number)
    NBTC_1_ID_5_NUMBER = "400.4063",                                // NBTC 1 ID 5 Number
    GET_CUSTOMER_VERIFY_STATE_FLOW_CONFIG_FAIL = "400.4064",        // Get customer verify state flow configuration fail
    UNDER_18_YEARS_OLD = "400.4065",                                // Under 18 years old
    CHECK_ELIGIBLE_CAMPAIGN_FAIL = "400.4066",                      // Check eligible camapign fail
    MAX_USE_BY_CAMPAIGN_PRIVILEGE = "400.4067",                     // Max use by campaign privilege

    // Apigee specific codes that are INPUT to transformError
    // These are the raw codes from Apigee that your `transformError` function handles.
    // QA might use these with `_simulate_error` to test the transformation logic.
    APIGEE_OTP_LIMIT_REACHED = "400.009.0003",                      // (Input for transformError, maps to OTP_LIMIT_REACHED - 400.4001)
    APIGEE_OTP_EXPIRED = "400.010.0014",                            // (Input for transformError, maps to OTP_HAS_EXPIRED - 400.4004)
    APIGEE_OTP_NOT_MATCH = "400.010.0015",                          // (Input for transformError, maps to OTP_IS_NOT_MATCH - 400.4002)
    APIGEE_OTP_NOT_MATCH_5_TIMES = "400.010.0016",                  // (Input for transformError, maps to OTP_IS_NOT_MATCH_5_TIMES - 400.4003)
    APIGEE_BLACKLISTED_CUSTOMER = "400.050.0014",                   // (Input for transformError, maps to BLACKLISTED_CUSTOMER_NOT_ALLOWED - 400.4006)
    APIGEE_CUSTOMER_IN_COLLECTION = "400.050.0015",                 // (Input for transformError, maps to CUSTOMER_IN_COLLECTION - 400.4042)
    APIGEE_CUSTOMER_FRAUD_FLAGGED = "400.050.0016",                 // (Input for transformError, maps to CUSTOMER_FRAUD_FLAGGED - 400.4043)
    APIGEE_OFFER_NOT_FOUND = "400.087.0008",                        // (Input for transformError, maps to OFFER_PACKAGE_NOT_FOUND - 400.4014)
}

export enum STATUS_MESSAGES {
   CUSTOMER_TYPE_NOT_ELIGIBLE = "Customer type is not eligible",
   NUMBER_CANCELLED_OR_PREPAID_SWITCH = "This number requested service cancellation or switch from a postpaid to a prepaid plan",
   CUSTOMER_SUSPENDED = "Customer is suspended",
   SUBSCRIBER_TYPE_NOT_POSTPAID = "Subscriber type is not postpaid",
   AGE_OF_USE_DOES_NOT_MEET_CRITERIA = "The age of use does not meet the required criteria",
   PACKAGE_IS_SHARE_PLAN = "Package is share plan",
   GET_PROFILE_INFO_FAIL = "Get profile info fail",
   NOT_ALLOWED_TO_EXTEND_CONTRACT = "Not allowed to extend contract",
}