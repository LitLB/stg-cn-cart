// src/shared/services/api-client.service.ts

import axios, {
	type AxiosInstance,
	type AxiosRequestConfig, // General config for making requests
	type InternalAxiosRequestConfig, // Specific config used by interceptors
	type AxiosResponse,
	type AxiosRequestHeaders, // Type for request headers object
	AxiosError,
} from "axios";
import axiosRetry from "axios-retry";

/**
 * ApiClientService
 *
 * A centralized HTTP client service built on top of the Axios library.
 * This service encapsulates common Axios configurations, implements automatic
 * request retries for transient network issues or specific server errors,
 * and provides standardized error handling and logging through interceptors.
 *
 * It is designed to be a foundational piece in a shared or infrastructure layer,
 * offering a consistent interface for making HTTP requests to external APIs
 * across different parts of an application (e.g., in a modular monolith).
 *
 * Key Features:
 * - **Base Configuration**: Initializes Axios with a base URL, default headers (e.g., 'Content-Type'), and a request timeout.
 * - **Automatic Retries**: Leverages 'axios-retry' to automatically retry failed requests based on configurable
 *   conditions (number of retries, retry delay strategy, and retriable HTTP status codes).
 * - **Interceptors**:
 *     - **Request Interceptor**: Can be extended to modify request configurations globally (e.g., adding authentication tokens).
 *       It receives an `InternalAxiosRequestConfig`.
 *     - **Response Interceptor**: Can be extended to transform response data or handle successful responses globally.
 *     - **Error Interceptor**: Logs detailed information about request errors (including timeouts, network issues, and HTTP errors)
 *       and ensures errors are propagated consistently.
 * - **Typed Responses**: HTTP methods (GET, POST, etc.) are generic, allowing callers to specify the expected type of the response data,
 *   enhancing type safety.
 *
 * @example
 * // Assuming ApiClientService is instantiated and configured
 * const apiClient = new ApiClientService("https://api.example.com", 30000, 3);
 *
 * interface User {
 *   id: number;
 *   name: string;
 * }
 *
 * // Making a GET request with an expected User[] response type
 * apiClient.get<User[]>("/users")
 *   .then(response => {
 *     console.log("Users:", response.data); // response.data is typed as User[]
 *   })
 *   .catch(error => {
 *     console.error("Failed to fetch users:", error);
 *   });
 */
export class ApiClientService {
	protected instance: AxiosInstance;
	private maxRetries: number;
	private retriableStatusCodes: number[];

	/**
	 * Constructs a new ApiClientService instance.
	 *
	 * @param baseURL - The base URL that will be prepended to all relative request URLs.
	 * @param timeout - The maximum time in milliseconds before a request is considered timed out. Defaults to 30000ms (30 seconds).
	 * @param maxRetries - The maximum number of retry attempts for requests that fail due to retriable conditions. Defaults to 0 (no retries).
	 * @param retriableStatusCodes - An array of HTTP status codes that should trigger a retry attempt.
	 *                               Defaults to [408 (Request Timeout), 500 (Internal Server Error), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)].
	 */
	constructor(
		baseURL: string,
		timeout = 30000,
		maxRetries = 0,
		retriableStatusCodes = [408, 500, 502, 503, 504],
	) {
		this.maxRetries = maxRetries;
		this.retriableStatusCodes = retriableStatusCodes;

		this.instance = axios.create({
			baseURL,
			headers: {
				"Content-Type": "application/json",
			} as AxiosRequestHeaders, // Explicitly type default headers
			timeout,
			maxContentLength: Infinity,
			maxBodyLength: Infinity,
		});

		this.initializeInterceptors();
	}

	/**
	 * Initializes the Axios interceptors for this service instance.
	 * This includes setting up:
	 * - Automatic request retries using `axios-retry`.
	 * - A request interceptor ({@link handleRequest}) to process/modify outgoing requests.
	 * - A response interceptor ({@link handleResponse}) to process successful incoming responses.
	 * - An error interceptor ({@link handleError}) for both request and response errors.
	 */
	private initializeInterceptors(): void {
		axiosRetry(this.instance, {
			retries: this.maxRetries,
			retryDelay: (retryCount: number, error: AxiosError) => {
				console.log(`Retrying request to ${error.config?.url}, attempt number ${retryCount}, delay: ${1000 * Math.pow(2, retryCount - 1)}ms`);
				return 1000 * Math.pow(2, retryCount - 1);
			},
			retryCondition: (error: AxiosError): boolean => {
				if (error.response) {
					return this.retriableStatusCodes.includes(error.response.status);
				}
				return axiosRetry.isNetworkOrIdempotentRequestError(error);
			},
		});

		this.instance.interceptors.request.use(
			this.handleRequest,
			this.handleError,
		);

		this.instance.interceptors.response.use(
			this.handleResponse,
			this.handleError,
		);
	}

	/**
	 * Request interceptor callback.
	 * This method is called by Axios before a request is sent. It receives an `InternalAxiosRequestConfig`
	 * object, which is a more detailed version of `AxiosRequestConfig` used internally by Axios.
	 * It can be overridden or extended in subclasses to add custom logic, such as dynamically
	 * adding authentication tokens or other headers to every request.
	 *
	 * Note: `InternalAxiosRequestConfig` ensures that `headers` is always an `AxiosRequestHeaders` object,
	 * simplifying header manipulation as null/undefined checks for `config.headers` itself are not needed.
	 *
	 * @param config - The `InternalAxiosRequestConfig` object for the outgoing request.
	 *                 This object is guaranteed by Axios to have a `headers` property of type `AxiosRequestHeaders`.
	 * @returns The (potentially modified) `InternalAxiosRequestConfig` or a Promise that resolves with it.
	 *          If a Promise is returned, it must resolve with the config object or reject with an error.
	 */
	protected handleRequest = (
		config: InternalAxiosRequestConfig,
	): InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig> => {
		// Example: Log outgoing request
		// console.log(`Sending request to ${config.url} with method ${config.method?.toUpperCase()}`);

		// `config.headers` is guaranteed to be an AxiosRequestHeaders object here.
		// No need for: config.headers = config.headers || {};
		// Example: Add an Authorization header if an accessToken exists
		// if (this.accessToken) { // Assuming this.accessToken is a property of your class
		//   config.headers.Authorization = `Bearer ${this.accessToken}`;
		// }
		return config;
	};

	/**
	 * Response interceptor callback.
	 * This method is called when a response is received successfully (e.g., HTTP 2xx status codes).
	 * It can be overridden or extended in subclasses to perform global response transformations
	 * or logging before the response is passed to the caller.
	 *
	 * @param response - The Axios response object.
	 * @returns The (potentially transformed) Axios response object.
	 */
	protected handleResponse = (response: AxiosResponse): AxiosResponse => {
		// Example: Log successful response
		// console.log(`Received response from ${response.config.url} with status ${response.status}`);
		return response;
	};

	/**
	 * Error interceptor callback.
	 * This method is called when a request fails or an error occurs during response processing.
	 * It logs detailed information about the error for debugging and monitoring purposes.
	 * The error is then re-thrown (rejected) to be handled by the calling code.
	 *
	 * @param error - The AxiosError object containing details about the failure.
	 * @returns A Promise that rejects with the original or a modified error.
	 *          It's crucial to return `Promise.reject(error)` to ensure the error propagates.
	 */
	protected handleError = (error: AxiosError): Promise<never> => {
		console.error(
			`API Request Error: ${error.message} (Code: ${error.code || "N/A"})`,
			`URL: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
		);

		if (error.response) {
			console.error(`  Response Status: ${error.response.status} ${error.response.statusText}`);
			console.error(`  Response Data: ${JSON.stringify(error.response.data)}`);
			console.error(`  Response Headers: ${JSON.stringify(error.response.headers)}`);
		} else if (error.request) {
			console.error("  Network Error: No response received from server. Request details:", error.request);
		} else {
			console.error("  Request Setup Error: Error during request configuration:", error.message);
		}

		if (error.code === "ECONNABORTED" && error.message.includes("timeout")) {
			console.error("  Detail: Request timed out.");
		}
		return Promise.reject(error);
	};

	/**
	 * Executes an HTTP GET request.
	 *
	 * @template T - The expected type of the response data. Defaults to `any`.
	 * @param url - The endpoint URL (relative to `baseURL`) for the GET request.
	 * @param config - Optional Axios request configuration to override defaults or add specific settings for this request.
	 * @returns A promise that resolves to an `AxiosResponse<T>` containing the server's response,
	 *          or rejects if an error occurs.
	 */
	public async get<T = any>(
		url: string,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse<T>> {
		return this.instance.get<T>(url, config);
	}

	/**
	 * Executes an HTTP POST request.
	 *
	 * @template T - The expected type of the response data. Defaults to `any`.
	 * @param url - The endpoint URL (relative to `baseURL`) for the POST request.
	 * @param data - The payload to be sent as the request body. Can be of any type.
	 * @param config - Optional Axios request configuration.
	 * @returns A promise that resolves to an `AxiosResponse<T>` from the server.
	 */
	public async post<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse<T>> {
		return this.instance.post<T>(url, data, config);
	}

	/**
	 * Executes an HTTP PUT request.
	 *
	 * @template T - The expected type of the response data. Defaults to `any`.
	 * @param url - The endpoint URL (relative to `baseURL`) for the PUT request.
	 * @param data - The payload to be sent as the request body.
	 * @param config - Optional Axios request configuration.
	 * @returns A promise that resolves to an `AxiosResponse<T>` from the server.
	 */
	public async put<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse<T>> {
		return this.instance.put<T>(url, data, config);
	}

	/**
	 * Executes an HTTP DELETE request.
	 * Note: For DELETE requests with a body, Axios requires the data to be passed within the `config` object.
	 *
	 * @template T - The expected type of the response data. Defaults to `any`.
	 * @param url - The endpoint URL (relative to `baseURL`) for the DELETE request.
	 * @param data - Optional payload for the DELETE request (typically not used or placed in `config.data`).
	 *               If you need to send a body with DELETE, include it in the `config.data` property.
	 * @param config - Optional Axios request configuration. If sending a body, set `config.data = yourPayload`.
	 * @returns A promise that resolves to an `AxiosResponse<T>` from the server.
	 */
	public async delete<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse<T>> {
		const finalConfig: AxiosRequestConfig = { ...config };
		if (data !== undefined && finalConfig.data === undefined) {
			finalConfig.data = data;
		}
		return this.instance.delete<T>(url, finalConfig);
	}

	/**
	 * Executes an HTTP PATCH request.
	 *
	 * @template T - The expected type of the response data. Defaults to `any`.
	 * @param url - The endpoint URL (relative to `baseURL`) for the PATCH request.
	 * @param data - The payload containing partial updates for the resource.
	 * @param config - Optional Axios request configuration.
	 * @returns A promise that resolves to an `AxiosResponse<T>` from the server.
	 */
	public async patch<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse<T>> {
		return this.instance.patch<T>(url, data, config);
	}
}
