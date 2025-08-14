
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
 * Represents the data for a single day in the projection table.
 * These documents would be stored in a subcollection under the user.
 */
export interface ForexDailyProjection {
  id?: string; // Document ID
  userId: string;
  day: number;
  date: Timestamp | string;
  
  // Real-time data, updated by operations
  capitalAtualUSD: number;
  evolucaoPercent: number; // Daily evolution percentage based on operations

  // Projections for Goal 1%
  capital1USD: number;
  capital1BRL: number;
  lotes1Mov05: number; // Lote size for 0.5% risk
  lotes1Mov1: number;  // Lote size for 1% risk

  // Projections for Goal 2%
  capital2USD: number;
  capital2BRL: number;
  lotes2Mov05: number;
  lotes2Mov1: number;
  
  // Projections for Goal 3%
  capital3USD: number;
  capital3BRL: number;
  lotes3Mov05: number;
  lotes3Mov1: number;
  
  // Projections for Goal 4%
  capital4USD: number;
  capital4BRL: number;
  lotes4Mov05: number;
  lotes4Mov1: number;
  
  // Projections for Goal 5%
  capital5USD: number;
  capital5BRL: number;
  lotes5Mov05: number;
  lotes5Mov1: number;
}

/**
 * Represents a single trading operation recorded by the user.
 */
export interface ForexOperation {
    id?: string;
    userId: string;
    date: Timestamp | string;
    loteSize: number;
    resultUSD?: number; // Profit or Loss in USD
    status: 'Aberta' | 'Fechada';
}

/**
 * Represents the aggregated dashboard metrics for a user.
 */
export interface ForexDashboardMetrics {
    userId: string;
    totalProfitLoss: number;
    avgDailyEvolution: number;
    bestDailyGain: number;
    worstDailyLoss: number;
    // Add other metrics as needed
}
