// tests/omni.service.test.ts

import { OmniService } from '../src/services/omni.service';
import { ApiClientService } from '../src/shared/services/api-client.service';
import { readConfiguration } from '../src/utils/config.utils';
// Corrected Import: Use VerifyDopaPOPStatusRequestBody for the request payload type
import { VerifyDopaPOPStatusRequestBody, VerifyDopaPOPApiResponse } from '../src/interfaces/dopa.interface';
import { AxiosResponse, AxiosError, InternalAxiosRequestConfig, AxiosRequestHeaders } from 'axios';

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
    let omniService: OmniService;
    let mockPost: jest.Mock; // Renamed for clarity, as it mocks ApiClientService.prototype.post

    const mockOmniConfig = {
        baseUrl: 'https://mock-omni-gateway.com',
        apiKey: 'test-omni-api-key',
        timeout: 15000,
        maxRetries: 2,
    };

    const mockInternalConfig: InternalAxiosRequestConfig = {
        headers: {} as AxiosRequestHeaders,
        url: '/proxy/verifyDopaPOPstatus',
        method: 'post',
    };


    beforeEach(() => {
        jest.clearAllMocks();

        // This mockReturnValue will be used for instances created *within this test's scope*,
        // specifically for the `omniService = new OmniService();` call below.
        // It overrides the default from the jest.mock factory for this specific call.
        (readConfiguration as jest.Mock).mockReturnValue({
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
        ApiClientService.prototype.post = mockPost;

        omniService = new OmniService();
    });

    describe('constructor', () => {
        it('should call super with the correct base URL, timeout, and maxRetries from config', () => {
            // ApiClientService is mocked, so we check the arguments passed to its mock constructor
            // The mock constructor of ApiClientService is implicitly created by jest.mock.
            // We are verifying that OmniService calls its 'super()' correctly.
            expect(ApiClientService).toHaveBeenCalledWith(
                mockOmniConfig.baseUrl,
                mockOmniConfig.timeout,
                mockOmniConfig.maxRetries
            );
            // @ts-ignore - Accessing private member for test verification
            expect(omniService['omniApiKey']).toBe(mockOmniConfig.apiKey);
        });
    }); // Closing constructor describe

    describe('verifyDopaPOPStatus', () => {
        const mockPayload: VerifyDopaPOPStatusRequestBody = {
            verifyDopaPOPstatus: {
                requestId: 'req-123',
                channel: 'ECP',
                idNumber: '1234567890123',
                dateOfBirth: '01011990',
                timeStamp: new Date(),
            },
        };

        const mockDopaApiResponse: VerifyDopaPOPApiResponse = {
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

        it('should call ApiClientService.post with correct URL, payload, and headers, and return data', async () => {
            mockPost.mockResolvedValue({ data: mockDopaApiResponse } as AxiosResponse<VerifyDopaPOPApiResponse>);

            const response = await omniService.verifyDopaPOPStatus(mockPayload);

            expect(mockPost).toHaveBeenCalledTimes(1);
            expect(mockPost).toHaveBeenCalledWith(
                '/proxy/verifyDopaPOPstatus',
                mockPayload,
                {
                    headers: {
                        'x-api-key': mockOmniConfig.apiKey,
                    },
                }
            );
            expect(response).toEqual(mockDopaApiResponse);
        });

        it('should propagate errors from ApiClientService.post', async () => {
            const mockError = new Error("Network Error") as AxiosError;
            mockError.config = mockInternalConfig;
            mockError.isAxiosError = true;
            mockError.toJSON = () => ({});

            mockPost.mockRejectedValue(mockError);

            await expect(omniService.verifyDopaPOPStatus(mockPayload)).rejects.toThrow("Network Error");
            expect(mockPost).toHaveBeenCalledTimes(1);
        });

        it('should handle API specific error structure returned as data if the HTTP call itself was successful', async () => {
            const errorStructDopaResponse: VerifyDopaPOPApiResponse = {
                resultResponse: {
                    resultCode: '400',
                    resultMessage: 'Bad Request from DOPA',
                }
            };
            mockPost.mockResolvedValue({ data: errorStructDopaResponse } as AxiosResponse<VerifyDopaPOPApiResponse>);

            const response = await omniService.verifyDopaPOPStatus(mockPayload);

            expect(response).toEqual(errorStructDopaResponse);
            expect(response.resultResponse.resultCode).toBe('400');
        });
    });
}); 