// src/ai/firebase-genkit.ts
/**
 * @fileOverview A dedicated Genkit instance for Firebase-only operations.
 * This instance does NOT include the googleAI plugin to avoid authentication
 * conflicts when flows only need to interact with Firebase services via the Admin SDK.
 */
import {genkit} from 'genkit';

// This is a "clean" Genkit instance without additional plugins.
export const firebaseAi = genkit();
