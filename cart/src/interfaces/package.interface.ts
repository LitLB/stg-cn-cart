export interface Package {
    package_code: string
    name: Language
    mobile: string
    t1: T1
    connector: Connector
    cms: Cms
}

export interface T1 {
	promotion: string
	promotionSet: string
	priceplanRcc: number
	penalty: number
	advancedPayment: number
	advancedPaymentCode: string
	advancedPaymentProposition: string
	contractTerm: number
}

export interface Connector {
	description: Language
}

export interface Language {
	"en-US": string
	"th-TH": string
}

export interface Cms {
	image: string
}
