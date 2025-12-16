
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

export interface TrainingQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface TrainingVideo {
  id: string;
  title: string;
  videoUrl: string;
  duration: number; // in seconds
}

export interface TrainingModule {
  id: string;
  title: string;
  videos: TrainingVideo[];
  quiz?: TrainingQuizQuestion[];
}

export interface QuizAttempt {
  score: number; // Percentage
  timestamp: string; // ISO Date String
  answers: { [questionId: string]: number }; // questionId: selectedOptionIndex
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
  fcmToken?: string; // For FCM notifications
  
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
        completed: boolean;
      };
      quizAttempts?: QuizAttempt[];
    };
  };

  // Personal finance data for superadmin
  personalFinance?: PersonalFinanceData;

  // New field for signed contract
  signedContractUrl?: string;

  // KYC Fields
  status?: 'pending_docs' | 'pending_approval' | 'approved' | 'rejected';
  documentUrl?: string;
  selfieUrl?: string;
  adminNotes?: string; // Reason for rejection
  kycSubmittedAt?: Timestamp | string;
  credits?: number;
  unlockedLeads?: string[];
  asaasCustomerId?: string; // Asaas customer ID
  referredBy?: string; // UID of the user who referred this one
  myReferralCode?: string; // This user's own referral code (usually their UID)
  plan?: string; // e.g., 'sdr_pro'
  subscriptionId?: string; // Asaas subscription ID
  lastSeen?: string; // ISO string for online status
  isOnline?: boolean;
  disabled?: boolean; // Added for user status
  approvedAt?: string | null; // Date of approval
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
  fcmToken?: string;

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
        completed: boolean;
      };
      quizAttempts?: QuizAttempt[];
    };
  };
  
  // Personal finance data for superadmin
  personalFinance?: PersonalFinanceData;

  // New field for signed contract
  signedContractUrl?: string;

  // KYC Fields
  status?: 'pending_docs' | 'pending_approval' | 'approved' | 'rejected';
  documentUrl?: string;
  selfieUrl?: string;
  adminNotes?: string;
  credits?: number;
  unlockedLeads?: string[];
  disabled?: boolean;
  approvedAt?: string | null;
};
