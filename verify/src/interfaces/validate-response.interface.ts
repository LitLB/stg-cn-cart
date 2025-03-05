export interface ICheckCustomerProfileResponse {
    thaiId: string;
    customerNo: string;
    aging: string;
    pricePlan: string | null;
    agreementId?: string 
}