"use strict";
// tests/omni.service.test.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const omni_service_1 = require("../src/services/omni.service");
const api_client_service_1 = require("../src/shared/services/api-client.service");
const config_utils_1 = require("../src/utils/config.utils");
// Mock ApiClientService methods
jest.mock('../src/shared/services/api-client.service');
// Mock readConfiguration
// Provide a default implementation that returns a valid config structure
// This will be used when 'omni.service.ts' (and other services) are imported and
// instantiate their global instances.
jest.mock('../src/utils/config.utils', () => ({
    readConfiguration: jest.fn(() => ({
        appPort: '8080',
        shutdownOnFatalError: 'false',
        // CTP base configs (can be minimal for default mock)
        ctpProjectKey: 'mock-default-ctp-project-key',
        ctpAuthUrl: 'mock-default-ctp-auth-url',
        ctpApiUrl: 'mock-default-ctp-api-url',
        ctpClientId: 'mock-default-ctp-client-id',
        ctpClientSecret: 'mock-default-ctp-client-secret',
        // Apigee config
        apigee: {
            baseUrl: 'mock-default-apigee-base-url',
            clientId: 'mock-default-apigee-client-id',
            clientSecret: 'mock-default-apigee-client-secret',
            privateKeyEncryption: 'mock-default-apigee-private-key',
            apiKey: 'mock-default-apigee-api-key',
        },
        // OTP config
        otp: {
            expireTime: '10',
            resendTime: '60',
            isMock: 'false',
            relatedPartyId: 'mock-default-otp-related-party-id',
            relatedPartyHref: 'mock-default-otp-related-party-href',
        },
        // Omni config - CRUCIAL for the error
        omni: {
            baseUrl: 'https://mock-omni-gateway-default.com',
            apiKey: 'test-omni-api-key-default',
            timeout: 30000,
            maxRetries: 3,
        },
        // Include other top-level keys if readConfiguration() structure expects them
        // and they are accessed by any globally instantiated service.
        // Example from your readConfiguration util:
        clientId: 'mock-ctp-client-id-validator', // for envValidators if it ran
        clientSecret: 'mock-ctp-client-secret-validator', // for envValidators
        projectKey: 'mock-ctp-project-key-validator', // for envValidators
        scope: 'mock-scope',
        region: 'europe-west1.gcp', // A valid region for envValidators
        bffCtpClientId: 'mock-bff-ctp-client-id',
        bffCtpClientSecret: 'mock-bff-ctp-client-secret',
    })),
}));
describe('OmniService', () => {
    let omniService;
    let mockPost; // Renamed for clarity, as it mocks ApiClientService.prototype.post
    const mockOmniConfig = {
        baseUrl: 'https://mock-omni-gateway.com',
        apiKey: 'test-omni-api-key',
        timeout: 15000,
        maxRetries: 2,
    };
    const mockInternalConfig = {
        headers: {},
        url: '/proxy/verifyDopaPOPstatus',
        method: 'post',
    };
    beforeEach(() => {
        jest.clearAllMocks();
        // This mockReturnValue will be used for instances created *within this test's scope*,
        // specifically for the `omniService = new OmniService();` call below.
        // It overrides the default from the jest.mock factory for this specific call.
        config_utils_1.readConfiguration.mockReturnValue({
            // Provide the specific omni config for the test
            omni: mockOmniConfig,
            // Include other necessary parts of the config if they were to be accessed
            // by the OmniService instance under test, or its parent ApiClientService.
            // For consistency, you can use the same structure as the default mock,
            // adjusting values as needed for the test.
            appPort: '8081', // Example: different port for test
            shutdownOnFatalError: 'true',
            ctpProjectKey: 'test-ctp-project-key',
            ctpAuthUrl: 'test-ctp-auth-url',
            ctpApiUrl: 'test-ctp-api-url',
            ctpClientId: 'test-ctp-client-id',
            ctpClientSecret: 'test-ctp-client-secret',
            apigee: {
                baseUrl: 'test-apigee-base-url',
                clientId: 'test-apigee-client-id',
                clientSecret: 'test-apigee-client-secret',
                privateKeyEncryption: 'test-apigee-private-key',
                apiKey: 'test-apigee-api-key',
            },
            otp: {
                expireTime: '5',
                resendTime: '30',
                isMock: 'true',
                relatedPartyId: 'test-otp-related-party-id',
                relatedPartyHref: 'test-otp-related-party-href',
            },
            clientId: 'test-ctp-client-id-validator',
            clientSecret: 'test-ctp-client-secret-validator',
            projectKey: 'test-ctp-project-key-validator',
            scope: 'test-scope',
            region: 'us-central1.gcp',
            bffCtpClientId: 'test-bff-ctp-client-id',
            bffCtpClientSecret: 'test-bff-ctp-client-secret',
        });
        // Mock the 'post' method of ApiClientService prototype
        mockPost = jest.fn();
        api_client_service_1.ApiClientService.prototype.post = mockPost;
        omniService = new omni_service_1.OmniService();
    });
    describe('constructor', () => {
        it('should call super with the correct base URL, timeout, and maxRetries from config', () => {
            // ApiClientService is mocked, so we check the arguments passed to its mock constructor
            // The mock constructor of ApiClientService is implicitly created by jest.mock.
            // We are verifying that OmniService calls its 'super()' correctly.
            expect(api_client_service_1.ApiClientService).toHaveBeenCalledWith(mockOmniConfig.baseUrl, mockOmniConfig.timeout, mockOmniConfig.maxRetries);
            // @ts-ignore - Accessing private member for test verification
            expect(omniService['omniApiKey']).toBe(mockOmniConfig.apiKey);
        });
    }); // Closing constructor describe
    describe('verifyDopaPOPStatus', () => {
        const mockPayload = {
            verifyDopaPOPstatus: {
                requestId: 'req-123',
                channel: 'ECP',
                idNumber: '1234567890123',
                dateOfBirth: '01011990',
                timeStamp: new Date(),
            },
        };
        const mockDopaApiResponse = {
            resultResponse: {
                resultCode: '200',
                resultMessage: 'Success',
                resultInfo: {
                    code: '00',
                    desc: 'สถานะปกติ',
                    flagBypass: 'N',
                    timeStamp: new Date().toISOString(),
                },
            }
        };
        it('should call ApiClientService.post with correct URL, payload, and headers, and return data', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPost.mockResolvedValue({ data: mockDopaApiResponse });
            const response = yield omniService.verifyDopaPOPStatus(mockPayload);
            expect(mockPost).toHaveBeenCalledTimes(1);
            expect(mockPost).toHaveBeenCalledWith('/proxy/verifyDopaPOPstatus', mockPayload, {
                headers: {
                    'x-api-key': mockOmniConfig.apiKey,
                },
            });
            expect(response).toEqual(mockDopaApiResponse);
        }));
        it('should propagate errors from ApiClientService.post', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockError = new Error("Network Error");
            mockError.config = mockInternalConfig;
            mockError.isAxiosError = true;
            mockError.toJSON = () => ({});
            mockPost.mockRejectedValue(mockError);
            yield expect(omniService.verifyDopaPOPStatus(mockPayload)).rejects.toThrow("Network Error");
            expect(mockPost).toHaveBeenCalledTimes(1);
        }));
        it('should handle API specific error structure returned as data if the HTTP call itself was successful', () => __awaiter(void 0, void 0, void 0, function* () {
            const errorStructDopaResponse = {
                resultResponse: {
                    resultCode: '400',
                    resultMessage: 'Bad Request from DOPA',
                }
            };
            mockPost.mockResolvedValue({ data: errorStructDopaResponse });
            const response = yield omniService.verifyDopaPOPStatus(mockPayload);
            expect(response).toEqual(errorStructDopaResponse);
            expect(response.resultResponse.resultCode).toBe('400');
        }));
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib21uaS5zZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvbW5pLnNlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsNkJBQTZCOzs7Ozs7Ozs7OztBQUU3QiwrREFBMkQ7QUFDM0Qsa0ZBQTZFO0FBQzdFLDREQUE4RDtBQUs5RCxnQ0FBZ0M7QUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO0FBRXZELHlCQUF5QjtBQUN6Qix5RUFBeUU7QUFDekUsaUZBQWlGO0FBQ2pGLHNDQUFzQztBQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDMUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzlCLE9BQU8sRUFBRSxNQUFNO1FBQ2Ysb0JBQW9CLEVBQUUsT0FBTztRQUM3QixxREFBcUQ7UUFDckQsYUFBYSxFQUFFLDhCQUE4QjtRQUM3QyxVQUFVLEVBQUUsMkJBQTJCO1FBQ3ZDLFNBQVMsRUFBRSwwQkFBMEI7UUFDckMsV0FBVyxFQUFFLDRCQUE0QjtRQUN6QyxlQUFlLEVBQUUsZ0NBQWdDO1FBQ2pELGdCQUFnQjtRQUNoQixNQUFNLEVBQUU7WUFDSixPQUFPLEVBQUUsOEJBQThCO1lBQ3ZDLFFBQVEsRUFBRSwrQkFBK0I7WUFDekMsWUFBWSxFQUFFLG1DQUFtQztZQUNqRCxvQkFBb0IsRUFBRSxpQ0FBaUM7WUFDdkQsTUFBTSxFQUFFLDZCQUE2QjtTQUN4QztRQUNELGFBQWE7UUFDYixHQUFHLEVBQUU7WUFDRCxVQUFVLEVBQUUsSUFBSTtZQUNoQixVQUFVLEVBQUUsSUFBSTtZQUNoQixNQUFNLEVBQUUsT0FBTztZQUNmLGNBQWMsRUFBRSxtQ0FBbUM7WUFDbkQsZ0JBQWdCLEVBQUUscUNBQXFDO1NBQzFEO1FBQ0Qsc0NBQXNDO1FBQ3RDLElBQUksRUFBRTtZQUNGLE9B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