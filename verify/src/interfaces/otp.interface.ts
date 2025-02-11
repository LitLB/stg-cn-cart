export interface Transaction {
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