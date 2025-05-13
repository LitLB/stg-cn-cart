export const CONFIGURATION_KEY = 'journeyActivationByOperator'
export const CONFIGURATION_CONTAINER = 'configuration';
export const verifyStateConfContainer = 'verifyState';
export const CUSTOMER_VERIFY_STATE_FLOW_CONFIG_CONTAINER = 'verifyState';
export enum CUSTOMER_VERIFY_STATES {
    dopa = "dopa",
    hlPreverFull = "hlPreverFull",
    hl4DScore = "hl4DScore",
    operator = "operator",
    profileAndPackage = "profileAndPackage",
    sharePlan = "sharePlan",
    blacklist = "blacklist",
    contractAndQuota = "contractAndQuota"
}