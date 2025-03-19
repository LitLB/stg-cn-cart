export interface JourneyActiveOperators {
    id: string;
    journey: string;
    operators: JourneyActiveOperator[];
}

interface JourneyActiveOperator {
    true: boolean;
    dtac: boolean;
}