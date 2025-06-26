
// src/types/user.ts
import type { Timestamp } from 'firebase/firestore';

export type UserType = 'admin' | 'vendedor' | 'user' | 'prospector' | 'pending_setup';

// Represents the data structure for a user in Firestore
export type FirestoreUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  cpf?: string;
  type: UserType;
  createdAt: Timestamp | string; // Timestamp in Firestore, string on client
  lastSignInTime?: Timestamp | string; // Timestamp in Firestore, string on client
  photoURL?: string | null;
  personalBalance?: number; 
  mlmBalance?: number; 
  uplineUid?: string; 
  downlineUids?: string[]; 
  mlmLevel?: number; 
};

// User object available in the auth context or passed as props
export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  cpf?: string; // Make CPF optional as it might not always be present
  type: UserType;
  photoURL?: string | null;
  personalBalance: number; // Should have a default in context if possibly undefined
  mlmBalance: number;    // Should have a default in context if possibly undefined
  createdAt?: Timestamp | string; // Make createdAt optional or ensure it's always string from context
  lastSignInTime?: string;
};
