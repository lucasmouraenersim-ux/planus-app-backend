
export interface Bankroll {
    name: string;
    initialCapital: number;
    currentCapital: number;
    usdbrl: number;
    startDate: string;
}

export interface Operation {
    id: string;
    date: string; // ISO string
    lotSize: number;
    result?: number; // in USD, can be positive or negative
    status: 'Aberta' | 'Fechada';
}

export interface ProjectionDay {
    day: number;
    date: string; // ISO string
    actualCapital: number;
    proj1: number;
    proj2: number;
    proj3: number;
    proj4: number;
    proj5: number;
    drawdown: number;
    lowRiskLots: number;
    highRiskLots: number;
}
