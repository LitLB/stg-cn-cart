import dayjs from 'dayjs';

/**
 * Generates a transaction ID in the format:
 *   yyyymmddHHMMss + random 6-digit number.
 *
 * Example: 20221026194300882999
 *
 * @returns {string} The generated transaction ID.
 */
export function generateTransactionId(): string {
  // Use Moment.js to format the current date and time.
  const dateTimeStr = dayjs().format('YYYYMMDDHHmmss');

  // Generate a random 6-digit number, padded with leading zeros.
  const randomSix = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');

  return dateTimeStr + randomSix;
}