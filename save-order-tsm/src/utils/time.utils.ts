/**
 * Calculates the exponential backoff time in milliseconds.
 * The backoff time is 2^(attempt-1) seconds, with a minimum of 1 second.
 * @param {number} attemptNumber - The current attempt number (1-indexed).
 * @returns {number} The exponential backoff time in milliseconds.
 */
export const calculateExponentialBackoffTime = (attemptNumber: number): number => {
    const minimumBackoffTime = 1000;
    const exponentialBackoffTime = minimumBackoffTime * 2 ** (attemptNumber - 1);

    return exponentialBackoffTime;
};