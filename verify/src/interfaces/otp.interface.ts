export interface RequestOTPToApigee {
  id: string;
  sendTime: string;
  description: string;
  channel: string;
  code: string;
  receiver: Receiver[];
}

export interface Receiver {
  phoneNumber: string;
  relatedParty: RelatedParty;
}

export interface RelatedParty {
  id: string;
  type?: string
}

export interface VerifyOTPToApigee {
  id: string;
  sendTime?: string;
  description: string;
  channel: string;
  code: string;
  content: string;
  receiver: Receiver[];
}

export interface verifyOtpRequest {
  mobileNumber: string;
  refCode: string;
  pin: string;
  journey: string;
}

export interface IGetProfileDtacRequest {
  id: string;
  channel: string;
  category: string;
  relatedParty: RelatedParty;
}

export interface IGetProfileTrueRequest {
  id: string;
  channel: string;
  limit: string;
  page: string;
  relatedParty: RelatedParty;
  characteristic: Characteristic[];
}

export interface Characteristic {
  name: string;
  value: string;
}

export interface checkCustomerProfileRequest {
  mobileNumber: string;
  journey: string;
}