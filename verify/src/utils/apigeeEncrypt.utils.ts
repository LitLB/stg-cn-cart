import * as crypto from 'crypto';

/**
 * Encrypt a value using AES-256 CBC with PKCS5Padding
 * @param {string} input - The text to encrypt
 * @param {string} key - The secret key (must be 32 bytes for AES-256)
 * @returns {string} - Base64 encoded string containing IV + Ciphertext
 */
export const apigeeEncrypt = (input: string, key: string): string => {
    const ivSize = 16; // Size of IV
    const keySize = key.length;

    // Generate a random IV
    const iv = crypto.randomBytes(ivSize);

    // Hash the key using SHA-256 and truncate to the key size
    const keyHash = crypto.createHash('sha256').update(key).digest();
    const truncatedKey = keyHash.slice(0, keySize);

    // Create the cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', truncatedKey, iv);

    // Encrypt the input and concatenate with the IV
    const encrypted = Buffer.concat([cipher.update(input, 'utf-8'), cipher.final()]);

    // Combine IV and encrypted data
    const encryptedIvAndText = Buffer.concat([iv, encrypted]);

    // Return the Base64 encoded result
    return encryptedIvAndText.toString('base64');
}

// export const apigeeDecrypt = (input: string, key: string): string => {
// }