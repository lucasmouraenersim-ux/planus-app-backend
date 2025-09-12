// src/types/user.ts
import type { Timestamp } from 'firebase/firestore';

export type UserType = 'admin' | 'superadmin' | 'vendedor' | 'user' | 'prospector' | 'pending_setup' | 'advogado';

interface PersonalExpense {
  id: string;
  description: string;
  amount: number;
  type: 'Fixo' | 'Variavel';
  installments: number;
}

interface PersonalRevenue {
  id: string;
  description: string;
  amount: number;
  date: string;
}

interface PersonalFinanceData {
  personalCapital: number;
  investmentAllocation: { stocks: number; fixedIncome: number; crypto: number; realEstate: number };
  expenses: PersonalExpense[];
  revenues: PersonalRevenue[];
}


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
  commissionRate?: number; // Direct commission percentage
  mlmEnabled?: boolean; // Is this user eligible for MLM overrides?
  uplineUid?: string; // UID of the user this person reports to for MLM
  recurrenceRate?: number; // Recurrence percentage

  // Permissions
  canViewLeadPhoneNumber?: boolean;
  canViewCareerPlan?: boolean;
  canViewCrm?: boolean;
  assignmentLimit?: number; // Max number of active leads a seller can have

  // Training Progress
  trainingProgress?: {
    [moduleId: string]: {
      [videoId: string]: {
        watchedSeconds: number;
        completed: boolean;
      };
    };
  };

  // Personal finance data for superadmin
  personalFinance?: PersonalFinanceData;
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
  commissionRate?: number;
  mlmEnabled?: boolean;
  uplineUid?: string;
  recurrenceRate?: number;
  
  // Permissions
  canViewLeadPhoneNumber?: boolean;
  canViewCareerPlan?: boolean;
  canViewCrm?: boolean;
  assignmentLimit?: number;

  // Training Progress
  trainingProgress?: {
    [moduleId: string]: {
      [videoId: string]: {
        watchedSeconds: number;
        completed: boolean;
      };
    };
  };
  
  // Personal finance data for superadmin
  personalFinance?: PersonalFinanceData;
};
