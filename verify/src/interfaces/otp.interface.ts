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
  id: string; // CONFIRM ?? Currently "VC-ECOM"
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