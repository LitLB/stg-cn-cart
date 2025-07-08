export type ReserveMsisdnRequest = {
    method: string;
    id: string;
    href: string;
    relatedParty: {
        id: string;
        type: string;
    };
    reserve: {
        id: string;
        href: string;
    };
    pstId: string;
};

export type ReserveMsisdnResponse = {
    code: string;
    description: string;
    timestamp: string;
    id?: string;
};
