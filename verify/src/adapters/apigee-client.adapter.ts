import axios, { AxiosResponse } from 'axios'
import { readConfiguration } from "../utils/config.utils";
import * as crypto from 'crypto';
import { RequestOTPToApigee, VerifyOTPToApigee } from '../interfaces/otp.interface';


class ApigeeClientAdapter {
    private readonly client: any
    private readonly apigeeConfig: any
    private accessToken: any
    private readonly config: any
    constructor() {
        this.apigeeConfig = readConfiguration().apigee
        this.client = axios.create({ baseURL: this.apigeeConfig.baseUrl })
        this.config = readConfiguration()
    }

    async init() {
        const { accessToken } = await this.getToken()
        this.accessToken = accessToken
    }

    async getToken(): Promise<any> {
        try {
            const url = 'oauth/v1/token';
            const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

            const response: AxiosResponse = await this.client.post(`${url}`, {
                grant_type: 'client_credentials',
                client_id: this.apigeeConfig.clientId,
                client_secret: this.apigeeConfig.clientSecret,
            }, { headers });

            return response.data
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                // Handle known Axios errors
                return { code: error.response?.status || 500, message: error.message };
            } else {
                // Handle other types of errors
                return { code: 500, message: 'An unexpected error occurred.' };
            }
        }

    }

    async apigeeDecrypt(encryptedInput: string) {
        const ivSize = 16; // IV size in bytes
        const key = this.config.apigee.privateKeyEncryption;


        // Decode the Base64 input to get the combined IV and encrypted text
        const encryptedIvAndText = Buffer.from(encryptedInput, 'base64');

        // Extract the IV from the first 16 bytes
        const iv = encryptedIvAndText.slice(0, ivSize);

        // Extract the encrypted text (everything after the IV)
        const encryptedText = encryptedIvAndText.slice(ivSize);

        // Derive the same truncated key used for encryption.
        // Note: The encryption function uses the length of the key string as the key size.


        const keySize = key.length;
        const keyHash = crypto.createHash('sha256').update(key).digest();
        const truncatedKey = keyHash.slice(0, keySize);

        // Create the decipher using the same algorithm, key, and IV
        const decipher = crypto.createDecipheriv('aes-256-cbc', truncatedKey, iv);

        // Decrypt the data and concatenate any remaining buffered bytes
        const decryptedBuffer = Buffer.concat([
            decipher.update(encryptedText),
            decipher.final(),
        ]);

        // Return the decrypted text as a UTF-8 string
        return decryptedBuffer.toString('utf-8');
    }

    async apigeeEncrypt(input: string) {
        const ivSize = 16; // Size of IV
        const key = this.config.apigee.privateKeyEncryption;
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

    async requestOTP(body: RequestOTPToApigee) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = '/communicationMessage/v1/generateOTP';
        const response: AxiosResponse = await this.client.post(`${url}`, body, { headers });
        return response.data;
    }

    async verifyOTP(body: VerifyOTPToApigee) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/communicationMessage/v1/verifyOTP`;
        const response: AxiosResponse = await this.client.post(`${url}`, body, { headers });
        return response.data;
    }

    async checkOperator(mobileNumber: string){
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/operator/v1/check?id=${mobileNumber}&txid=1234567`;
        const response: AxiosResponse = await this.client.get(`${url}`, { headers });
        return response.data;
    }
}

export default ApigeeClientAdapter