// src/types/user.ts
import type { Timestamp } from 'firebase/firestore';

export type UserType = 'admin' | 'superadmin' | 'vendedor' | 'user' | 'prospector' | 'pending_setup';

// Represents the data structure for a user in Firestore
export type FirestoreUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  cpf?: string;
  phone?: string;
  type: UserType;
  createdAt: Timestamp | string; // Timestamp in Firestore, string on client
  lastSignInTime?: Timestamp | string; // Timestamp in Firestore, string on client
  photoURL?: string | null;
  personalBalance?: number; 
  mlmBalance?: number; 
  termsAcceptedAt?: Timestamp | string; // New field
  
  // New Commission Fields
  commissionRate?: 40 | 50 | 60 | 80; // Direct commission percentage
  mlmEnabled?: boolean; // Is this user eligible for MLM overrides?
  uplineUid?: string; // UID of the user this person reports to for MLM
  recurrenceRate?: 0.5 | 1; // Recurrence percentage

  // Permissions
  canViewLeadPhoneNumber?: boolean;
  canViewCareerPlan?: boolean;
  canViewCrm?: boolean;
  assignmentLimit?: number; // Max number of active leads a seller can have
};

// User object available in the auth context or passed as props
export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  cpf?: string; 
  phone?: string;
  type: UserType;
  photoURL?: string | null;
  personalBalance: number; 
  mlmBalance: number;    
  createdAt?: Timestamp | string; 
  lastSignInTime?: string;
  termsAcceptedAt?: string; 

  // New Commission Fields
  commissionRate?: 40 | 50 | 60 | 80;
  mlmEnabled?: boolean;
  uplineUid?: string;
  recurrenceRate?: 0.5 | 1;
  
  // Permissions
  canViewLeadPhoneNumber?: boolean;
  canViewCareerPlan?: boolean;
  canViewCrm?: boolean;
  assignmentLimit?: number;
};
