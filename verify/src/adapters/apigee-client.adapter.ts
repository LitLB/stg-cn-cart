import axios, { AxiosResponse } from 'axios'
import { readConfiguration } from "../utils/config.utils";
import * as crypto from 'crypto';
import { IGetProfileDtacRequest, IGetProfileTrueRequest, RequestOTPToApigee, VerifyOTPToApigee } from '../interfaces/otp.interface';
import { VerifyDopaPOPStatusApiRequest, VerifyDopaPOPStatusApiResponse } from '../interfaces/dopa.interface';

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
        try {
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
        } catch (error: any) {

            const normalizedError = {
                statusCode: 400,
                statusMessage: "Invalid format",
                errorCode: "FAILED_TO_DECRYPT_DATA"
            }
            throw normalizedError
        }
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
        return response;
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
        return response;
    }

    async checkOperator(mobileNumber: string, txid: string) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/operator/v1/check?id=${mobileNumber}&txid=${txid}`;
        const response: AxiosResponse = await this.client.get(`${url}`, { headers });
        return response;
    }

    async getProfileAndPackage(body: Partial<IGetProfileDtacRequest | IGetProfileTrueRequest>) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/customerProfile/v2/profileAndPackage`;
        const response: AxiosResponse = await this.client.post(`${url}`, body, { headers });

        return response;
    }

    async checkBacklistDtac(id: string, thaiId: string, custValue: string) {

        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/customer/v2/checkBlackList?channelName=ECP&transactionId=${id}&idType=IDCard&idValue=${thaiId}&funcID=2&channel=dtac&custValue=${custValue}`;
        const response: AxiosResponse = await this.client.get(`${url}`, { headers });
        return response;
    }

    async checkBacklistTrue(id: string, cardId: string) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/customer/v2/checkBlackList?channelName=ECP&transactionId=${id}&idType=IDCard&idValue=${cardId}&channel=true&companyCode=AL&verifyType=AL&accountCat=I&activityFunction=EXISTING&activityFunctionType=null`;
        const response: AxiosResponse = await this.client.get(`${url}`, { headers });
        return response;
    }

    async checkSharePlanDtac(id: string) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/customerManagement/v1/customerProf?id=${id}`;
        const response: AxiosResponse = await this.client.get(`${url}`, { headers });
        return response;
    }

    async getContractAndQuotaDtac(id: string, thaiId: string) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/agreementManagement/v1/agreement?id=${id}&type=Quota&agreementType=1&engagedParty.id=${thaiId}`;
        const response: AxiosResponse = await this.client.get(`${url}`, { headers });
        return response;
    }

    async getContractAndQuotaTrue(id: string, agreementId: string) {
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/agreementManagement/v1/agreement?channel=true&id=${id}&agreementId=${agreementId}&entityType=SUBSCRIBER`;
        const response: AxiosResponse = await this.client.get(`${url}`, { headers });
        return response;
    }

    async getCustomerTierDtac(id: string, phoneNumber: string) {
        await this.init()

        // * Phone number must decrypted before use format 6698XXXXXXX

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/loyaltyManagement/v1/loyaltyProgramMember?id=${id}&phoneNumber=${phoneNumber}`;
        const response: AxiosResponse = await this.client.get(`${url}`, { headers });
        return response;
    }

    async getCustomerTierTrue(mobileNumber: string) {
        const relatedPartyId = this.config.otp.relatedPartyId
        const relatedPartyHref = this.config.otp.relatedPartyHref
        await this.init()
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'Cookies': 'ROUTEID=.'
        };
        const url = `/loyaltyManagement/v1/loyaltyProgramMember?relatedParty.id=${relatedPartyId}&relatedParty.href=${relatedPartyHref}&type=true&customerIdnNo=${mobileNumber}&fields=hasCard%3BtrueCard%3BaccountGrade%3BadditionalData%3BmainPointsBalance%3BisEmployee%3BhasProduct%3BhasTrueId%3BredemptionEnabled%3BfirstName%3BlastName%3Bmultiplier%3BloyaltyCustomerId&idnType=TMH&extensions=trueCard%2CaccountGrade%2CadditionalData`;
        const response: AxiosResponse = await this.client.get(`${url}`, { headers });
        return response;
    }

    async verifyDopaPOPStatus(payload: VerifyDopaPOPStatusApiRequest): Promise<AxiosResponse<VerifyDopaPOPStatusApiResponse>> {
        // No need to call this.init() if using separate API key for this endpoint
        // However, if it uses the same oauth token, then this.init() is needed.
        // Based on spec, it seems to use 'x-api-key', not Bearer token for this proxy.
        // If it ALSO needs Bearer, then uncomment:
        // await this.init();

        const headers: Record<string, string> = { // Define headers type
            'Content-Type': 'application/json',
            'x-api-key': this.apigeeConfig.apiKey
        };
        // If Bearer token is also needed:
        // if (this.accessToken) {
        //     headers['Authorization'] = `Bearer ${this.accessToken}`;
        // } else {
        //      await this.init(); // Ensure token is fetched if not present
        //      headers['Authorization'] = `Bearer ${this.accessToken}`;
        // }

        const url = '/proxy/verifyDopaPOPstatus'; // Path from OMX-verifyDopaPOPstatus-100225-042038.pdf
        const response: AxiosResponse<VerifyDopaPOPStatusApiResponse> = await this.client.post(url, payload, { headers });
        return response;
    }
}

export default ApigeeClientAdapter