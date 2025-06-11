export interface VerifyHLRequestBody {
    correlationId: string;
    channel: string;
    customerInfo: CustomerInfo;
    validate: validate[]
    dealerCode?: string;
    companyCode?: string;
    propoId?: string;
    campaignInfo?: CampaignInfo;
    activityFunction?: string;
    activityFunctionType?: string;
    userLogin?: string;
}

export interface CustomerInfo {
    identification: string;
    identificationType: string;
    birthDate: string;
    customerType: string;
    accountType?: string;
    requestSubscriber?: string | number;
}

export interface validate {
    name: string
    function: string[]
}

export interface CampaignInfo {
    campaignCode: string | undefined;
    productCode: string | undefined;
}

export interface VerifyHLResponse {
    code: string;
    description: string;
    correlationId: string;
    message: Message;
    data: Data
}

export interface Message {
    messageTh: string;
    messageEn: string;
}

export interface Data {
    isProductTrue: boolean
    totalProduct: number,
    hasProduct: boolean;
    blacklistColor: string;

}