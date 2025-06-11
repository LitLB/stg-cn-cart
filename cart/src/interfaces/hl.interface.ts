export interface IHLCheckEligibleBody {
    operator: string;
    companyCode: string;
    profile: IHLProfile[];
    productBundle: IHLProductBundle
}

interface IHLProfile {
    certificationId: string;
    certificationType: string;
}

interface IHLProductBundle {
    bundleKey: string;
    sku: string;
    customerAge: number;
    campaignGroup?: string;
    customerJourney?: string;
    campaignByJourney?: string;
    poolNumberGroup?: string;
    customerLoyalty?: string;
    pricePlan?: string;
    ageOfUse?: string;
    packageContract?: string;
}