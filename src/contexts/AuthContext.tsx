
"use client";

import type { User as FirebaseUser } from 'firebase/auth';
import type { AppUser, FirestoreUser, UserType } from '@/types/user';
import React, { useContext, useState, useEffect, ReactNode, useCallback, createContext } from 'react';
import { onAuthStateChanged, updateProfile as updateFirebaseProfile, updatePassword as updateFirebasePassword, reauthenticateWithCredential, EmailAuthProvider, signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, Timestamp, updateDoc, query, orderBy } from 'firebase/firestore';
import { auth, db, messaging } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage';
import type { LeadWithId } from '@/types/crm';
import { getToken, onMessage } from 'firebase/messaging';
import { useToast } from '@/hooks/use-toast';
import { generateImpersonationToken } from '@/actions/admin/impersonation';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  isLoadingAuth: boolean;
  userAppRole: UserType | null;
  allFirestoreUsers: FirestoreUser[];
  isLoadingAllUsers: boolean;
  isImpersonating: boolean; // Novo
  originalAdminUser: AppUser | null; // Novo
  impersonateUser: (targetUserId: string) => Promise<void>; // Novo
  stopImpersonating: () => Promise<void>; // Novo
  updateAppUserProfile: (data: { displayName?: string; photoFile?: File; phone?: string; personalFinance?: FirestoreUser['personalFinance'] }) => Promise<void>;
  changeUserPassword: (currentPasswordProvided: string, newPasswordProvided: string) => Promise<void>;
  acceptUserTerms: () => Promise<void>;
  refreshUsers: () => Promise<void>; 
  fetchAllCrmLeadsGlobally: () => Promise<LeadWithId[]>;
  updateAppUser: (user: AppUser | null) => void;
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

  // --- NOVO: Impersonation State ---
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdminUser, setOriginalAdminUser] = useState<AppUser | null>(null);


  // --- FCM Logic ---
  const requestNotificationPermission = useCallback(async (userId: string) => {
    if (typeof window === 'undefined' || !messaging || !('Notification' in window)) return;

    try {
      if (Notification.permission === 'granted') {
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
          console.error("VAPID key não encontrada nas variáveis de ambiente.");
          return;
        }
        
        const currentToken = await getToken(messaging, { vapidKey });
        if (currentToken) {
          const userDocRef = doc(db, "users", userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().fcmToken !== currentToken) {
            await updateDoc(userDocRef, { fcmToken: currentToken });
          }
        }
      }
    } catch (err) {
      console.error('An error occurred while retrieving token. ', err);
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


  const fetchFirestoreUser = async (user: FirebaseUser | null): Promise<AppUser | null> => {
    if (!user) return null;
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const firestoreUserData = userDocSnap.data() as FirestoreUser;
        const isSuperAdminByEmail = user.email === 'lucasmoura@sentenergia.com' || user.email === 'lucasmourafoto@sentenergia.com';
        
        const finalType = isSuperAdminByEmail ? 'superadmin' : firestoreUserData.type;
        
        if (isSuperAdminByEmail && firestoreUserData.type !== 'superadmin') {
            await updateDoc(userDocRef, { type: 'superadmin' });
        }
        
        const canViewCrm = finalType === 'superadmin' || finalType === 'admin' || finalType === 'advogado' || firestoreUserData.canViewCrm;

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
          canViewLeadPhoneNumber: finalType === 'superadmin' || firestoreUserData.canViewLeadPhoneNumber || false,
          canViewCareerPlan: finalType !== 'superadmin' && (firestoreUserData.canViewCareerPlan !== false),
          canViewCrm: canViewCrm,
          assignmentLimit: firestoreUserData.assignmentLimit,
          trainingProgress: firestoreUserData.trainingProgress,
          personalFinance: firestoreUserData.personalFinance,
          signedContractUrl: firestoreUserData.signedContractUrl,
        };
      } else {
        console.warn('Firestore document for user ${user.uid} not found. A base document will be created upon user action if needed.');
        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            type: 'pending_setup',
            personalBalance: 0,
            mlmBalance: 0,
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
      updatesForFirestore.phone = data.phone.replace(/\D/g, '');
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
        const toISOString = (timestamp: any) => {
            if (timestamp instanceof Timestamp) {
                return timestamp.toDate().toISOString();
            }
            if (typeof timestamp === 'string') {
                return timestamp;
            }
            return undefined;
        };
        
        return {
          id: docSnap.id,
          ...data,
          createdAt: toISOString(data.createdAt) || new Date().toISOString(),
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
  
  // --- NOVO: Lógica de Impersonation ---
  const impersonateUser = async (targetUserId: string) => {
    if (!appUser || !firebaseUser || (appUser.type !== 'admin' && appUser.type !== 'superadmin')) {
      toast({ title: "Erro", description: "Apenas administradores podem usar esta função.", variant: "destructive" });
      return;
    }
    
    try {
      // 1. Store current admin session
      const adminToken = await firebaseUser.getIdToken();
      sessionStorage.setItem('adminToken', adminToken);
      setOriginalAdminUser(appUser);
      
      // 2. Get custom token for target user from server action
      const result = await generateImpersonationToken({ adminUserId: appUser.uid, targetUserId });
      if (!result.success || !result.customToken) {
        throw new Error(result.message || "Falha ao gerar token de personificação.");
      }
      
      // 3. Sign in with the custom token
      await signInWithCustomToken(auth, result.customToken);
      setIsImpersonating(true);
      toast({ title: "Iniciando personificação...", description: "Você agora está navegando como o usuário selecionado." });
      // The onAuthStateChanged listener will handle the UI update
    } catch (error: any) {
      console.error("Impersonation failed:", error);
      toast({ title: "Erro de Personificação", description: error.message, variant: "destructive" });
      // Clear stored admin session if impersonation fails
      sessionStorage.removeItem('adminToken');
      setOriginalAdminUser(null);
    }
  };

  const stopImpersonating = async () => {
    const adminToken = sessionStorage.getItem('adminToken');
    if (!adminToken || !originalAdminUser) {
      // If something is wrong, just log out completely for safety
      await signOut(auth);
      return;
    }
    
    try {
      // Artificially sign out to trigger onAuthStateChanged
      await signOut(auth);
      // Immediately sign back in with the stored admin token
      await signInWithCustomToken(auth, adminToken);
      
      sessionStorage.removeItem('adminToken');
      setIsImpersonating(false);
      setOriginalAdminUser(null);
      toast({ title: "Personificação Encerrada", description: "Você retornou à sua conta de administrador." });
    } catch (error) {
      console.error("Failed to stop impersonating:", error);
      toast({ title: "Erro", description: "Falha ao retornar para sua conta. Por favor, faça login novamente.", variant: "destructive" });
      await signOut(auth); // Log out fully on error
    }
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoadingAuth(true);
      const storedAdminToken = sessionStorage.getItem('adminToken');
      
      if (user) {
        setFirebaseUser(user);
        const fetchedAppUser = await fetchFirestoreUser(user);
        setAppUser(fetchedAppUser);
        const role = fetchedAppUser?.type || 'pending_setup';
        setUserAppRole(role);

        // Check if currently impersonating
        if (storedAdminToken && fetchedAppUser && fetchedAppUser.type !== 'admin' && fetchedAppUser.type !== 'superadmin') {
            setIsImpersonating(true);
            // We need to fetch the original admin user's data to store it
            if (!originalAdminUser) {
                // This part is tricky because we can't easily get the admin user data without being logged in as them.
                // We will rely on the data stored when impersonation started.
            }
        } else {
            setIsImpersonating(false);
            setOriginalAdminUser(null);
            sessionStorage.removeItem('adminToken');
        }

        await refreshUsers();
        await requestNotificationPermission(user.uid);
      } else {
        // User logged out
        setFirebaseUser(null);
        setAppUser(null);
        setUserAppRole(null);
        setAllFirestoreUsers([]);
        setIsLoadingAllUsers(false);
        setIsImpersonating(false);
        setOriginalAdminUser(null);
        sessionStorage.removeItem('adminToken');
      }
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [refreshUsers, requestNotificationPermission, originalAdminUser]);

  const updateAppUser = (user: AppUser | null) => {
    setAppUser(user);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, isLoadingAuth, userAppRole, allFirestoreUsers, isLoadingAllUsers, updateAppUserProfile, changeUserPassword, acceptUserTerms, refreshUsers, fetchAllCrmLeadsGlobally, updateAppUser, isImpersonating, impersonateUser, stopImpersonating, originalAdminUser }}>
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
