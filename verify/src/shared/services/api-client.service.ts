// src/shared/services/api-client.service.ts

import axios, {
	type AxiosInstance,
	type AxiosRequestConfig,
	type AxiosResponse,
	AxiosError,
} from "axios";
import axiosRetry from "axios-retry";

/**
 * ApiClientService
 *
 * A centralized HTTP client service built on top of axios.
 * It encapsulates axios configuration, retry logic, and error handling.
 * 
 * This service is intended to be part of the shared or infrastructure layer
 * in a modular monolith architecture. It provides a single entry point for
 * performing HTTP requests to external APIs with consistent behavior.
 *
 * Key features:
 * - Configures axios with a base URL, default headers, and timeout.
 * - Uses axiosRetry to automatically retry requests for specific HTTP error codes.
 * - Implements interceptors to log and handle errors uniformly.
 *
 * @example
 * const apiClient = new ApiClientService("http://api.example.com", 30000, 3);
 * apiClient.get("/users").then(response => console.log(response.data));
 */
export class ApiClientService {
	protected instance: AxiosInstance;
	private maxRetries: number;
	private retriableStatusCodes: number[];

	/**
	 * Constructs a new ApiClientService instance.
	 *
	 * @param baseURL - The base URL for all API requests.
	 * @param timeout - The maximum time (in ms) before a request times out. Default is 30000.
	 * @param maxRetries - The number of retry attempts for failed requests. Default is 0.
	 * @param retriableStatusCodes - An array of HTTP status codes that should trigger a retry.
	 *                               Default is [408, 500, 502, 503, 504].
	 */
	constructor(
		baseURL: string,
		timeout = 30000,
		maxRetries = 0,
		retriableStatusCodes = [408, 500, 502, 503, 504],
	) {
		this.maxRetries = maxRetries;
		this.retriableStatusCodes = retriableStatusCodes;

		// Create a new axios instance with the given configuration.
		this.instance = axios.create({
			baseURL,
			headers: {
				"Content-Type": "application/json",
			},
			timeout,
			maxContentLength: Infinity,
			maxBodyLength: Infinity,
		});

		// Set up interceptors for request, response, and retry behavior.
		this.initializeInterceptors();
	}

	/**
	 * Initializes axios interceptors for:
	 * - Automatic retries using axiosRetry.
	 * - Logging and modifying requests before they are sent.
	 * - Processing responses and handling errors.
	 */
	private initializeInterceptors(): void {
		axiosRetry(this.instance, {
			retries: this.maxRetries,
			retryDelay: (retryCount: number) => {
				// Use exponential backoff for retry delays.
				return 1000 * Math.pow(2, retryCount);
			},
			retryCondition: (error: AxiosError) =>
				error.response
					? this.retriableStatusCodes.includes(error.response.status)
					: true,
		});

		// Intercept outgoing requests.
		this.instance.interceptors.request.use(
			this.handleRequest,
			this.handleError,
		);

		// Intercept incoming responses.
		this.instance.interceptors.response.use(
			this.handleResponse,
			this.handleError,
		);
	}

	/**
	 * Request interceptor.
	 *
	 * Can be extended to add custom headers or modify the request configuration.
	 *
	 * @param config - The original Axios request configuration.
	 * @returns The potentially modified configuration.
	 */
	protected handleRequest = (
		config: AxiosRequestConfig,
	): AxiosRequestConfig | any => {
		return config;
	};

	/**
	 * Response interceptor.
	 *
	 * Processes successful responses before they are returned to the caller.
	 *
	 * @param response - The Axios response object.
	 * @returns The unchanged response (can be modified if needed).
	 */
	protected handleResponse = (response: AxiosResponse): AxiosResponse => {
		return response;
	};

	/**
	 * Error interceptor.
	 *
	 * Handles errors from the axios instance by logging key details
	 * and propagating the error so that the caller can handle it.
	 *
	 * @param error - The Axios error object.
	 * @returns A rejected promise with the error.
	 */
	protected handleError = (error: AxiosError): Promise<never> => {
		console.log(`Error Type: ${error.code || "No Code"}`);
		console.log(`Error Message: ${error.message}`);

		if (error.response) {
			console.log(`Response Status: ${error.response.status}`);
			console.log(`Response Data: ${JSON.stringify(error.response.data)}`);
		} else {
			console.log("No HTTP response was received.");
		}

		if (error.code === "ECONNABORTED" && error.message.includes("timeout")) {
			console.log("Timeout: Request timed out.");
		}

		if (!error.response && error.request) {
			console.log("Network Error: The request was made but no response was received");
		} else if (!error.response && !error.request) {
			console.log("Request Setup Error: An error occurred setting up the request.");
		}

		console.log("Complete Error Object:", JSON.stringify(error, null, 2));
		console.log("error.response", error.response);

		return Promise.reject(error);
	};

	/**
	 * Executes an HTTP GET request.
	 *
	 * @param url - The endpoint URL (relative to baseURL).
	 * @param config - Optional Axios configuration overrides.
	 * @returns A promise that resolves to the Axios response.
	 */
	public async get(
		url: string,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse> {
		return await this.instance.get(url, config);
	}

	/**
	 * Executes an HTTP POST request.
	 *
	 * @param url - The endpoint URL (relative to baseURL).
	 * @param data - The payload to send in the request body.
	 * @param config - Optional Axios configuration overrides.
	 * @returns A promise that resolves to the Axios response.
	 */
	public async post(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse> {
		return await this.instance.post(url, data, config);
	}

	/**
	 * Executes an HTTP PUT request.
	 *
	 * @param url - The endpoint URL (relative to baseURL).
	 * @param data - The payload to send in the request body.
	 * @param config - Optional Axios configuration overrides.
	 * @returns A promise that resolves to the Axios response.
	 */
	public async put(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse> {
		return await this.instance.put(url, data, config);
	}

	/**
	 * Executes an HTTP DELETE request.
	 *
	 * @param url - The endpoint URL (relative to baseURL).
	 * @param data - The payload to be sent as request data (if needed).
	 * @param config - Optional Axios configuration overrides.
	 * @returns A promise that resolves to the Axios response.
	 */
	public async delete(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse> {
		const finalConfig: AxiosRequestConfig = {
			...config,
			data,
		};
		return await this.instance.delete(url, finalConfig);
	}

	/**
	 * Executes an HTTP PATCH request.
	 *
	 * @param url - The endpoint URL (relative to baseURL).
	 * @param data - The payload to send in the request body.
	 * @param config - Optional Axios configuration overrides.
	 * @returns A promise that resolves to the Axios response.
	 */
	public async patch(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<AxiosResponse> {
		return await this.instance.patch(url, data, config);
	}
}
