export type SimInfo = {
    sku: string;
    number: string;
    simType: string;
    propositionCode: string;
    groupNumber: {
        'th-TH': string;
        'en-US': string;
    };
    correlatorId: string;
    selectNumberCreateAt: string;
};

export type CustomerInfo = {
    sessionId: string;
    verifyMobileNumberValue: string;
    verifyMobileNumberStatus: 'skip' | 'success' | 'fail';
    verifyCertificationIdValue: string;
    verifyCertificationTypeValue: string;
    verifyCertificationStatus: 'skip' | 'success' | 'fail';
    verifyBirthdateValue: string;
    verifyBirthdateStatus: 'skip' | 'success' | 'fail';
    customerProfile: {
        companyCode: string;
        birthdate: string;
        operator: string;
        certificationType: string;
        certificationId: string;
        isProductTrue: string;
    };
    createAt: string;
    updateAt: string;
};
