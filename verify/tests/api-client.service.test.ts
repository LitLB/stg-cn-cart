// src/shared/services/api-client.service.test.ts

/**
 * Unit tests for ApiClientService.
 *
 * This test suite verifies the following aspects of the ApiClientService:
 * 
 * 1. **Axios Retry Configuration:**  
 *    Ensures that the axios instance is configured with the expected retry settings
 *    (number of retries, retry delay function, and retry condition).
 * 
 * 2. **HTTP Methods (GET, POST, PUT, DELETE, PATCH):**  
 *    Each method is tested to confirm it calls the underlying axios method with 
 *    the correct URL, payload, and configuration. A minimal configuration object is used 
 *    (with a `headers` property) to satisfy type requirements.
 * 
 * 3. **Error Propagation:**  
 *    Verifies that errors thrown by the axios instance are properly propagated by the 
 *    ApiClientService's error interceptor.
 *
 * Note: The axios module and axiosRetry are mocked to isolate the service's behavior.
 */

import axios, { AxiosInstance, AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import { ApiClientService } from "../src/shared/services/api-client.service";

// Mock axios and axiosRetry to control behavior in tests.
jest.mock("axios");
jest.mock("axios-retry");

describe("ApiClientService", () => {
    let apiClient: ApiClientService;
    let mockAxiosInstance: Partial<AxiosInstance>;

    // Define a minimal config object with a headers property.
    // Casting to 'any' bypasses strict type requirements for testing purposes.
    const minimalConfig = { headers: {} } as any;

    beforeEach(() => {
        // Create a mock axios instance with jest.fn() for HTTP methods and interceptors.
        mockAxiosInstance = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
            patch: jest.fn(),
            interceptors: {
                // Provide both 'use' and 'eject' to fulfill the AxiosInterceptorManager interface.
                request: { use: jest.fn(), eject: jest.fn() } as any,
                response: { use: jest.fn(), eject: jest.fn() } as any,
            },
        };

        // Ensure axios.create returns our mocked instance.
        (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

        // Create a new instance of ApiClientService with dummy parameters.
        apiClient = new ApiClientService("http://localhost", 1000, 2);
    });

    afterEach(() => {
        // Clear all mocks after each test to prevent test interference.
        jest.clearAllMocks();
    });

    test("should configure axiosRetry with correct parameters", () => {
        // Verify that axiosRetry is called with the expected configuration options.
        expect(axiosRetry).toHaveBeenCalledWith(
            mockAxiosInstance,
            expect.objectContaining({
                retries: 2,
                retryDelay: expect.any(Function),
                retryCondition: expect.any(Function),
            })
        );
    });

    test("get method should call instance.get with correct arguments", async () => {
        // Prepare a mock response for the GET request.
        const response: AxiosResponse = {
            data: { result: "ok" },
            status: 200,
            statusText: "OK",
            headers: {},
            config: minimalConfig,
        };
        (mockAxiosInstance.get as jest.Mock).mockResolvedValue(response);

        // Execute the GET request.
        const result = await apiClient.get("/test");

        // Assert that axios.get was called correctly and the response is as expected.
        expect(mockAxiosInstance.get).toHaveBeenCalledWith("/test", undefined);
        expect(result).toEqual(response);
    });

    test("post method should call instance.post with correct arguments", async () => {
        // Prepare a mock response for the POST request.
        const response: AxiosResponse = {
            data: { result: "created" },
            status: 201,
            statusText: "Created",
            headers: {},
            config: minimalConfig,
        };
        (mockAxiosInstance.post as jest.Mock).mockResolvedValue(response);
        const payload = { name: "John" };

        // Execute the POST request.
        const result = await apiClient.post("/test", payload);

        // Assert that axios.post was called with the correct URL, payload, and config.
        expect(mockAxiosInstance.post).toHaveBeenCalledWith("/test", payload, undefined);
        expect(result).toEqual(response);
    });

    test("put method should call instance.put with correct arguments", async () => {
        // Prepare a mock response for the PUT request.
        const response: AxiosResponse = {
            data: { result: "updated" },
            status: 200,
            statusText: "OK",
            headers: {},
            config: minimalConfig,
        };
        (mockAxiosInstance.put as jest.Mock).mockResolvedValue(response);
        const payload = { name: "Jane" };

        // Execute the PUT request.
        const result = await apiClient.put("/test", payload);

        // Assert that axios.put was called correctly.
        expect(mockAxiosInstance.put).toHaveBeenCalledWith("/test", payload, undefined);
        expect(result).toEqual(response);
    });

    test("delete method should call instance.delete with correct arguments", async () => {
        // Prepare a mock response for the DELETE request.
        const response: AxiosResponse = {
            data: { result: "deleted" },
            status: 200,
            statusText: "OK",
            headers: {},
            config: minimalConfig,
        };
        (mockAxiosInstance.delete as jest.Mock).mockResolvedValue(response);
        const payload = { id: 1 };

        // Execute the DELETE request.
        const result = await apiClient.delete("/test", payload);

        // Assert that axios.delete was called with a config containing the data payload.
        expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/test", { data: payload });
        expect(result).toEqual(response);
    });

    test("patch method should call instance.patch with correct arguments", async () => {
        // Prepare a mock response for the PATCH request.
        const response: AxiosResponse = {
            data: { result: "patched" },
            status: 200,
            statusText: "OK",
            headers: {},
            config: minimalConfig,
        };
        (mockAxiosInstance.patch as jest.Mock).mockResolvedValue(response);
        const payload = { op: "replace", path: "/name", value: "Doe" };

        // Execute the PATCH request.
        const result = await apiClient.patch("/test", payload);

        // Assert that axios.patch was called correctly.
        expect(mockAxiosInstance.patch).toHaveBeenCalledWith("/test", payload, undefined);
        expect(result).toEqual(response);
    });

    test("should propagate errors through handleError", async () => {
        // Simulate an error from the axios GET request.
        const error = {
            code: "ERR_TEST",
            message: "Test error",
            response: {
                status: 500,
                data: { error: "Internal Server Error" },
            },
            request: {},
        };
        (mockAxiosInstance.get as jest.Mock).mockRejectedValue(error);

        // Assert that the error is properly propagated when the GET method fails.
        await expect(apiClient.get("/test")).rejects.toEqual(error);
    });
});
