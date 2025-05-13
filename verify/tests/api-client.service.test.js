"use strict";
// src/shared/services/api-client.service.test.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const api_client_service_1 = require("../src/shared/services/api-client.service");
// Mock axios and axiosRetry to control behavior in tests.
jest.mock("axios");
jest.mock("axios-retry");
describe("ApiClientService", () => {
    let apiClient;
    let mockAxiosInstance;
    // Define a minimal config object with a headers property.
    // Casting to 'any' bypasses strict type requirements for testing purposes.
    const minimalConfig = { headers: {} };
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
                request: { use: jest.fn(), eject: jest.fn() },
                response: { use: jest.fn(), eject: jest.fn() },
            },
        };
        // Ensure axios.create returns our mocked instance.
        axios_1.default.create.mockReturnValue(mockAxiosInstance);
        // Create a new instance of ApiClientService with dummy parameters.
        apiClient = new api_client_service_1.ApiClientService("http://localhost", 1000, 2);
    });
    afterEach(() => {
        // Clear all mocks after each test to prevent test interference.
        jest.clearAllMocks();
    });
    test("should configure axiosRetry with correct parameters", () => {
        // Verify that axiosRetry is called with the expected configuration options.
        expect(axios_retry_1.default).toHaveBeenCalledWith(mockAxiosInstance, expect.objectContaining({
            retries: 2,
            retryDelay: expect.any(Function),
            retryCondition: expect.any(Function),
        }));
    });
    test("get method should call instance.get with correct arguments", () => __awaiter(void 0, void 0, void 0, function* () {
        // Prepare a mock response for the GET request.
        const response = {
            data: { result: "ok" },
            status: 200,
            statusText: "OK",
            headers: {},
            config: minimalConfig,
        };
        mockAxiosInstance.get.mockResolvedValue(response);
        // Execute the GET request.
        const result = yield apiClient.get("/test");
        // Assert that axios.get was called correctly and the response is as expected.
        expect(mockAxiosInstance.get).toHaveBeenCalledWith("/test", undefined);
        expect(result).toEqual(response);
    }));
    test("post method should call instance.post with correct arguments", () => __awaiter(void 0, void 0, void 0, function* () {
        // Prepare a mock response for the POST request.
        const response = {
            data: { result: "created" },
            status: 201,
            statusText: "Created",
            headers: {},
            config: minimalConfig,
        };
        mockAxiosInstance.post.mockResolvedValue(response);
        const payload = { name: "John" };
        // Execute the POST request.
        const result = yield apiClient.post("/test", payload);
        // Assert that axios.post was called with the correct URL, payload, and config.
        expect(mockAxiosInstance.post).toHaveBeenCalledWith("/test", payload, undefined);
        expect(result).toEqual(response);
    }));
    test("put method should call instance.put with correct arguments", () => __awaiter(void 0, void 0, void 0, function* () {
        // Prepare a mock response for the PUT request.
        const response = {
            data: { result: "updated" },
            status: 200,
            statusText: "OK",
            headers: {},
            config: minimalConfig,
        };
        mockAxiosInstance.put.mockResolvedValue(response);
        const payload = { name: "Jane" };
        // Execute the PUT request.
        const result = yield apiClient.put("/test", payload);
        // Assert that axios.put was called correctly.
        expect(mockAxiosInstance.put).toHaveBeenCalledWith("/test", payload, undefined);
        expect(result).toEqual(response);
    }));
    test("delete method should call instance.delete with correct arguments", () => __awaiter(void 0, void 0, void 0, function* () {
        // Prepare a mock response for the DELETE request.
        const response = {
            data: { result: "deleted" },
            status: 200,
            statusText: "OK",
            headers: {},
            config: minimalConfig,
        };
        mockAxiosInstance.delete.mockResolvedValue(response);
        const payload = { id: 1 };
        // Execute the DELETE request.
        const result = yield apiClient.delete("/test", payload);
        // Assert that axios.delete was called with a config containing the data payload.
        expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/test", { data: payload });
        expect(result).toEqual(response);
    }));
    test("patch method should call instance.patch with correct arguments", () => __awaiter(void 0, void 0, void 0, function* () {
        // Prepare a mock response for the PATCH request.
        const response = {
            data: { result: "patched" },
            status: 200,
            statusText: "OK",
            headers: {},
            config: minimalConfig,
        };
        mockAxiosInstance.patch.mockResolvedValue(response);
        const payload = { op: "replace", path: "/name", value: "Doe" };
        // Execute the PATCH request.
        const result = yield apiClient.patch("/test", payload);
        // Assert that axios.patch was called correctly.
        expect(mockAxiosInstance.patch).toHaveBeenCalledWith("/test", payload, undefined);
        expect(result).toEqual(response);
    }));
    test("should propagate errors through handleError", () => __awaiter(void 0, void 0, void 0, function* () {
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
        mockAxiosInstance.get.mockRejectedValue(error);
        // Assert that the error is properly propagated when the GET method fails.
        yield expect(apiClient.get("/test")).rejects.toEqual(error);
    }));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLWNsaWVudC5zZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhcGktY2xpZW50LnNlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaURBQWlEOzs7Ozs7Ozs7Ozs7OztBQUVqRDs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1CRztBQUVILGtEQUE0RDtBQUM1RCw4REFBcUM7QUFDckMsa0ZBQTZFO0FBRTdFLDBEQUEwRDtBQUMxRCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ25CLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7QUFFekIsUUFBUSxDQUFDLGtCQUFrQixFQUFFLEdBQUcsRUFBRTtJQUM5QixJQUFJLFNBQTJCLENBQUM7SUFDaEMsSUFBSSxpQkFBeUMsQ0FBQztJQUU5QywwREFBMEQ7SUFDMUQsMkVBQTJFO0lBQzNFLE1BQU0sYUFBYSxHQUFHLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBUyxDQUFDO0lBRTdDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDWixpRkFBaUY7UUFDakYsaUJBQWlCLEdBQUc7WUFDaEIsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7WUFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtZQUNmLEdBQUcsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO1lBQ2QsTUFBTSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7WUFDakIsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7WUFDaEIsWUFBWSxFQUFFO2dCQUNWLG1GQUFtRjtnQkFDbkYsT0FBTyxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFTO2dCQUNwRCxRQUFRLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxJ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