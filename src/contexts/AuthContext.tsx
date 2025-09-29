
"use client";

import type { User as FirebaseUser } from 'firebase/auth';
import type { AppUser, FirestoreUser, UserType } from '@/types/user';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, updateProfile as updateFirebaseProfile, updatePassword as updateFirebasePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, Timestamp, updateDoc, query, orderBy } from 'firebase/firestore';
import { auth, db, messaging } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage';
import type { LeadWithId } from '@/types/crm';
import { getToken, onMessage } from 'firebase/messaging';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  isLoadingAuth: boolean;
  userAppRole: UserType | null;
  allFirestoreUsers: FirestoreUser[];
  isLoadingAllUsers: boolean;
  updateAppUserProfile: (data: { displayName?: string; photoFile?: File; phone?: string; personalFinance?: FirestoreUser['personalFinance'] }) => Promise<void>;
  changeUserPassword: (currentPasswordProvided: string, newPasswordProvided: string) => Promise<void>;
  acceptUserTerms: () => Promise<void>;
  refreshUsers: () => Promise<void>; 
  fetchAllCrmLeadsGlobally: () => Promise<LeadWithId[]>;
  updateAppUser: (user: AppUser | null) => void; // Function to update user state locally
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userAppRole, setUserAppRole] = useState<AuthContextType['userAppRole']>(null);
  const [allFirestoreUsers, setAllFirestoreUsers] = useState<FirestoreUser[]>([]);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState<boolean>(true);

  // --- FCM Logic ---
  const requestNotificationPermission = useCallback(async (userId: string) => {
    if (typeof window === 'undefined' || !messaging) return;

    console.log('Requesting notification permission for superadmin...');
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Let Firebase SDK handle the VAPID key
        const currentToken = await getToken(messaging);
        if (currentToken) {
          console.log('FCM Token obtained:', currentToken);
          const userDocRef = doc(db, "users", userId);
          await updateDoc(userDocRef, { fcmToken: currentToken });
          console.log('FCM Token saved to Firestore.');
        } else {
          console.log('No registration token available. Request permission to generate one.');
        }
      } else {
        console.log('Unable to get permission to show notifications.');
      }
    } catch (err) {
      console.error('An error occurred while retrieving token or permission. ', err);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && messaging) {
      const unsubscribeOnMessage = onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        toast({
          title: payload.notification?.title || "Nova Notificação",
          description: payload.notification?.body || "",
        });
      });
      return () => unsubscribeOnMessage();
    }
  }, [toast]);
  // --- End FCM Logic ---

  const fetchFirestoreUser = async (user: FirebaseUser | null): Promise<AppUser | null> => {
    if (!user) return null;
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      const isSuperAdmin = user.email === 'lucasmoura@sentenergia.com';

      if (userDocSnap.exists()) {
        const firestoreUserData = userDocSnap.data() as FirestoreUser;
        // The user is admin, force the type to 'superadmin' regardless of what's in Firestore.
        const finalType = isSuperAdmin ? 'superadmin' : firestoreUserData.type;
        const canViewCrm = isSuperAdmin || firestoreUserData.type === 'admin' || firestoreUserData.type === 'advogado' || firestoreUserData.canViewCrm;
        
        if (isSuperAdmin && firestoreUserData.type !== 'superadmin') {
            await setDoc(userDocRef, { type: 'superadmin' }, { merge: true });
        }


        return {
          uid: user.uid,
          email: user.email,
          displayName: firestoreUserData.displayName || user.displayName,
          photoURL: firestoreUserData.photoURL || user.photoURL,
          type: finalType,
          cpf: firestoreUserData.cpf,
          phone: firestoreUserData.phone,
          personalBalance: firestoreUserData.personalBalance || 0,
          mlmBalance: firestoreUserData.mlmBalance || 0,
          createdAt: (firestoreUserData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          lastSignInTime: (firestoreUserData.lastSignInTime as Timestamp)?.toDate().toISOString() || (user.metadata.lastSignInTime || undefined),
          termsAcceptedAt: (firestoreUserData.termsAcceptedAt as Timestamp)?.toDate().toISOString() || undefined,
          commissionRate: firestoreUserData.commissionRate,
          mlmEnabled: firestoreUserData.mlmEnabled,
          uplineUid: firestoreUserData.uplineUid,
          recurrenceRate: firestoreUserData.recurrenceRate,
          canViewLeadPhoneNumber: isSuperAdmin || firestoreUserData.canViewLeadPhoneNumber || false,
          canViewCareerPlan: isSuperAdmin || firestoreUserData.canViewCareerPlan || false,
          canViewCrm: canViewCrm,
          assignmentLimit: firestoreUserData.assignmentLimit,
          trainingProgress: firestoreUserData.trainingProgress, // Include training progress
          personalFinance: firestoreUserData.personalFinance,
          signedContractUrl: firestoreUserData.signedContractUrl,
        };
      } else {
        console.warn(`Firestore document for user ${user.uid} not found. Creating a base document.`);
        const newUserType: UserType = isSuperAdmin ? 'superadmin' : 'user';
        const newFirestoreUser: FirestoreUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            type: newUserType,
            createdAt: Timestamp.now(),
            personalBalance: 0,
            mlmBalance: 0,
            canViewLeadPhoneNumber: isSuperAdmin,
            canViewCrm: isSuperAdmin,
            canViewCareerPlan: isSuperAdmin,
        };
        await setDoc(userDocRef, newFirestoreUser);
        return {
            ...newFirestoreUser,
            createdAt: (newFirestoreUser.createdAt as Timestamp).toDate().toISOString(),
        } as AppUser;
      }
    } catch (error) {
      console.error("Error fetching user data from Firestore:", error);
      return null;
    }
  };
  
  const updateAppUserProfile = async (data: { displayName?: string; photoFile?: File; phone?: string, personalFinance?: FirestoreUser['personalFinance'] }) => {
    if (!firebaseUser) throw new Error("Usuário não autenticado.");

    let newPhotoURL: string | undefined = undefined;
    const updatesForFirestore: Partial<FirestoreUser> = {};
    const updatesForFirebaseAuth: { displayName?: string; photoURL?: string } = {};

    if (data.photoFile) {
      try {
        const filePath = `profile_photos/${firebaseUser.uid}/${data.photoFile.name}`;
        newPhotoURL = await uploadFile(data.photoFile, filePath);
        updatesForFirebaseAuth.photoURL = newPhotoURL;
        updatesForFirestore.photoURL = newPhotoURL;
      } catch (error) {
        console.error("Erro ao fazer upload da foto:", error);
        throw new Error("Falha ao fazer upload da nova foto.");
      }
    }

    if (data.displayName && data.displayName !== appUser?.displayName) {
      updatesForFirebaseAuth.displayName = data.displayName;
      updatesForFirestore.displayName = data.displayName;
    }

    if (data.phone !== undefined && data.phone !== appUser?.phone) {
      updatesForFirestore.phone = data.phone.replace(/\D/g, ''); // Normalize phone number
    }
    
    if (data.personalFinance) {
        updatesForFirestore.personalFinance = data.personalFinance;
    }

    if (Object.keys(updatesForFirebaseAuth).length > 0) {
      await updateFirebaseProfile(firebaseUser, updatesForFirebaseAuth);
    }

    if (Object.keys(updatesForFirestore).length > 0) {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await updateDoc(userDocRef, updatesForFirestore);
    }
    
    const updatedAppUser = await fetchFirestoreUser(firebaseUser);
    if (updatedAppUser) {
        setAppUser(updatedAppUser);
        setUserAppRole(updatedAppUser.type);
    }
  };

  const changeUserPassword = async (currentPasswordProvided: string, newPasswordProvided: string) => {
    if (!firebaseUser || !firebaseUser.email) throw new Error("Usuário não autenticado ou email não disponível.");
    
    const credential = EmailAuthProvider.credential(firebaseUser.email, currentPasswordProvided);
    
    try {
        await reauthenticateWithCredential(firebaseUser, credential);
        await updateFirebasePassword(firebaseUser, newPasswordProvided);
    } catch (error) {
        console.error("Erro ao alterar senha:", error);
        throw error;
    }
  };

  const acceptUserTerms = async () => {
    if (!firebaseUser) throw new Error("User not authenticated.");
    const userDocRef = doc(db, "users", firebaseUser.uid);
    try {
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, { termsAcceptedAt: Timestamp.now() }, { merge: true });
      } else {
        await updateDoc(userDocRef, { termsAcceptedAt: Timestamp.now() });
      }
      
      setAppUser(prev => {
        if (!prev) return null;
        return { ...prev, termsAcceptedAt: new Date().toISOString() };
      });
    } catch (error) {
      console.error("Error accepting terms:", error);
      throw new Error("Failed to accept terms.");
    }
  };

  const refreshUsers = useCallback(async () => {
    setIsLoadingAllUsers(true);
    try {
      const usersCollectionRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollectionRef);
      const usersList = usersSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          uid: docSnap.id, ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          lastSignInTime: (data.lastSignInTime as Timestamp)?.toDate().toISOString() || undefined,
          termsAcceptedAt: (data.termsAcceptedAt as Timestamp)?.toDate().toISOString() || undefined,
        } as FirestoreUser;
      });
      setAllFirestoreUsers(usersList);
    } catch (error) {
      console.error("Error fetching all users (this is expected for non-admins):", error);
      setAllFirestoreUsers([]);
    } finally {
      setIsLoadingAllUsers(false);
    }
  }, []);

  const fetchAllCrmLeadsGlobally = useCallback(async (): Promise<LeadWithId[]> => {
    try {
      const leadsCollectionRef = collection(db, "crm_leads");
      const q = query(leadsCollectionRef, orderBy("lastContact", "desc"));
      const leadsSnapshot = await getDocs(q);
      return leadsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        // Helper to safely convert Timestamp to ISO string
        const toISOString = (timestamp: any) => {
            if (timestamp instanceof Timestamp) {
                return timestamp.toDate().toISOString();
            }
            if (typeof timestamp === 'string') {
                 // If it's already a string, just return it. Could add validation.
                return timestamp;
            }
            return undefined; // Return undefined for invalid types
        };
        
        return {
          id: docSnap.id,
          ...data,
          createdAt: toISOString(data.createdAt) || new Date().toISOString(), // Fallback to now if missing
          lastContact: toISOString(data.lastContact) || new Date().toISOString(),
          signedAt: toISOString(data.signedAt),
          completedAt: toISOString(data.completedAt),
        } as LeadWithId;
      });
    } catch (error) {
      console.error("Error fetching all CRM leads globally (this is expected for non-admins):", error);
      return [];
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoadingAuth(true);
      if (user) {
        setFirebaseUser(user);
        const fetchedAppUser = await fetchFirestoreUser(user);
        setAppUser(fetchedAppUser);
        const role = fetchedAppUser?.type || 'pending_setup';
        setUserAppRole(role);
        await refreshUsers();
        // Forcefully request notification permission for superadmin on login
        if (role === 'superadmin') {
          await requestNotificationPermission(user.uid);
        }
      } else {
        setFirebaseUser(null);
        setAppUser(null);
        setUserAppRole(null);
        setAllFirestoreUsers([]);
        setIsLoadingAllUsers(false);
      }
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [refreshUsers, requestNotificationPermission]);


  const updateAppUser = (user: AppUser | null) => {
    setAppUser(user);
  };


  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, isLoadingAuth, userAppRole, allFirestoreUsers, isLoadingAllUsers, updateAppUserProfile, changeUserPassword, acceptUserTerms, refreshUsers, fetchAllCrmLeadsGlobally, updateAppUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
