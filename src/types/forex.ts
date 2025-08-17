// src/types/forex.ts
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the structure for a user's initial Forex setup.
 * This is likely stored once per user.
 */
export interface ForexBancaConfig {
  id?: string; // Document ID
  userId: string; // The UID of the user who owns this config
  name: string; // e.g., "Banca Principal"
  initialCapitalUSD: number;
  usdToBrlRate: number;
  startDate: Timestamp | string; // Timestamp in Firestore, string on client
}

/**
 * Represents a single trading operation recorded by the user.
 */
export interface ForexOperation {
    id?: string;
    userId: string;
    createdAt: Timestamp | string;
    closedAt?: Timestamp | string;
    loteSize: number;
    resultUSD?: number; // Profit or Loss in USD
    status: 'Aberta' | 'Fechada';
}
