import * as crypto from 'crypto';

export const hashKey = (key: string): Buffer => {
    // Create a SHA-256 hash of the key.
    return crypto.createHash('sha256').update(key).digest();
}

export const encryptedOFB = (inp: string, key: string): string => {
    let result = "";
    // Generate a hashed key (32 bytes for AES-256)
    const keyHashed = hashKey(key);

    try {
        // Use the first 16 bytes of the hashed key as the IV.
        const iv = keyHashed.slice(0, 16);
        // Create a cipher using AES-256-OFB.
        const cipher = crypto.createCipheriv('aes-256-ofb', keyHashed, iv);

        // Encrypt the plaintext.
        const encryptedBuffer = Buffer.concat([
            cipher.update(inp, 'utf8'),
            cipher.final()
        ]);

        // Concatenate the IV and encrypted data.
        const concatenated = Buffer.concat([iv, encryptedBuffer]);

        // Base64-encode the result.
        result = concatenated.toString('base64');
    } catch (error) {
        console.error("Encryption error:", error);
    }

    return result;
}