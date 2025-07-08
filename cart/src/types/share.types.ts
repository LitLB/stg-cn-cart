export type ProductType = 'main_product' | 'add_on' | 'service' | 'free_gift' | 'bundle' | 'sim';
export type CampaignGroup = 'mass' | 'flashsale' | 'combo_set';
export type Journey = 'device_only' | 'mnp';
export type LoyaltyTier = 'red' | 'black';
export type CampaignByJourney = 'bdbc' | 'super_deal';
export type PropositionGroup = 399 | 499 | 599 | 699 | 799 | 899 | 1199;
export type CompareRedisData = {
    isEqual: boolean,
    dataChange: any
}
export interface SimInfo {
    sku: string;
    number: string;
    simType: string;
    groupNumber: Record<string, string>;
    correlatorId: string | undefined | null;
    selectNumberCreateAt?: string;
}
