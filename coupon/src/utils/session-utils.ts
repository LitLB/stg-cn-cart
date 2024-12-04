// server/utils/session-utils.ts

import dayjs from 'dayjs';


/**
 * Calculates the expiration timestamp by subtracting a buffer time from the token's total expiration time.
 *
 * @param expiresInSeconds - The total time in seconds until the token expires.
 * @param bufferTimeSeconds - The buffer time in seconds to subtract from the total expiration time.
 *                              Defaults to 0 seconds (no buffer) if not provided.
 * @returns The expiration Date object.
 *
 * @throws Will throw an error if expiresInSeconds is not a positive integer.
 */
export function calculateExpiration(
	expiresInSeconds: number,
	bufferTimeSeconds = 0,
): Date {
	if (typeof expiresInSeconds !== 'number' || expiresInSeconds <= 0) {
		throw new Error('Invalid expiresInSeconds value provided.');
	}

	const adjustedExpiresInSeconds = expiresInSeconds > bufferTimeSeconds ? expiresInSeconds - bufferTimeSeconds : 0;

	const expiredAtDate = dayjs().add(adjustedExpiresInSeconds, 'second');

	return expiredAtDate.toDate();
}