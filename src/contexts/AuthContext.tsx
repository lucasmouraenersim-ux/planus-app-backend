
"use client";

import type { User as FirebaseUser } from 'firebase/auth';
import type { AppUser, FirestoreUser } from '@/types/user';
import type { LeadWithId } from '@/types/crm';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, updateProfile as updateFirebaseProfile, updatePassword as updateFirebasePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage'; // Import uploadFile

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  isLoadingAuth: boolean;
  userAppRole: 'admin' | 'vendedor' | 'user' | 'prospector' | 'pending_setup' | null;
  allFirestoreUsers: FirestoreUser[];
  isLoadingAllUsers: boolean;
  fetchAllAppUsers: () => Promise<void>;
  fetchAllCrmLeadsGlobally: () => Promise<LeadWithId[]>;
  updateAppUserProfile: (data: { displayName?: string; photoFile?: File }) => Promise<void>;
  changeUserPassword: (currentPasswordProvided: string, newPasswordProvided: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userAppRole, setUserAppRole] = useState<AuthContextType['userAppRole']>(null);

  const [allFirestoreUsers, setAllFirestoreUsers] = useState<FirestoreUser[]>([]);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState<boolean>(true);

  const fetchFirestoreUser = async (user: FirebaseUser | null): Promise<AppUser | null> => {
    if (!user) return null;
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const firestoreUserData = userDocSnap.data() as FirestoreUser;
        const createdAtTimestamp = firestoreUserData.createdAt as Timestamp;
        const lastSignInTimestamp = firestoreUserData.lastSignInTime as Timestamp;
        return {
          uid: user.uid,
          email: user.email,
          displayName: firestoreUserData.displayName || user.displayName,
          photoURL: firestoreUserData.photoURL || user.photoURL,
          type: firestoreUserData.type,
          cpf: firestoreUserData.cpf,
          personalBalance: firestoreUserData.personalBalance || 0,
          mlmBalance: firestoreUserData.mlmBalance || 0,
          createdAt: createdAtTimestamp ? createdAtTimestamp.toDate().toISOString() : new Date().toISOString(),
          lastSignInTime: lastSignInTimestamp ? lastSignInTimestamp.toDate().toISOString() : (user.metadata.lastSignInTime || undefined),
        };
      } else {
        console.warn(`Firestore document for user ${user.uid} not found.`);
        if (user.email === 'lucasmoura@sentenergia.com') {
          return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || "Admin Lucas",
            type: 'admin',
            personalBalance: 0,
            mlmBalance: 0,
            createdAt: new Date().toISOString(),
          };
        }
        return { // Fallback for users without a Firestore doc (pending setup)
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            type: 'pending_setup',
            personalBalance: 0,
            mlmBalance: 0,
            createdAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error("Error fetching user data from Firestore:", error);
      return null;
    }
  };
  
  const updateAppUserProfile = async (data: { displayName?: string; photoFile?: File }) => {
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

    if (Object.keys(updatesForFirebaseAuth).length > 0) {
      await updateFirebaseProfile(firebaseUser, updatesForFirebaseAuth);
    }

    if (Object.keys(updatesForFirestore).length > 0) {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await updateDoc(userDocRef, updatesForFirestore);
    }
    
    // Refetch or update appUser state
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
        throw error; // Re-throw para ser tratado na UI
    }
  };


  const fetchAllAppUsers = useCallback(async () => {
    setIsLoadingAllUsers(true);
    try {
        const usersCollectionRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersCollectionRef);
        const usersList = usersSnapshot.docs.map(docSnap => {
            const data = docSnap.data() as Omit<FirestoreUser, 'uid'>;
            const createdAtTimestamp = data.createdAt as Timestamp;
            const lastSignInTimestamp = data.lastSignInTime as Timestamp;
            return {
                ...data,
                uid: docSnap.id,
                createdAt: createdAtTimestamp ? createdAtTimestamp.toDate().toISOString() : new Date().toISOString(),
                lastSignInTime: lastSignInTimestamp ? lastSignInTimestamp.toDate().toISOString() : undefined,
            } as FirestoreUser;
        });
        setAllFirestoreUsers(usersList);
    } catch (error) {
        console.error("Erro ao buscar todos os usuários do Firestore:", error);
        setAllFirestoreUsers([]);
    } finally {
        setIsLoadingAllUsers(false);
    }
  }, []);

  const fetchAllCrmLeadsGlobally = useCallback(async (): Promise<LeadWithId[]> => {
    try {
      const leadsCollectionRef = collection(db, "crm_leads");
      const leadsSnapshot = await getDocs(leadsCollectionRef);
      const leadsList = leadsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
          lastContact: (data.lastContact as Timestamp).toDate().toISOString(),
          signedAt: data.signedAt ? (data.signedAt as Timestamp).toDate().toISOString() : undefined,
        } as LeadWithId;
      });
      return leadsList;
    } catch (error) {
      console.error("Erro ao buscar todos os leads do CRM:", error);
      return [];
    }
  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoadingAuth(true);
      setFirebaseUser(user);

      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists() && user.metadata.lastSignInTime) {
            await updateDoc(userDocRef, {
              lastSignInTime: Timestamp.fromDate(new Date(user.metadata.lastSignInTime))
            });
          }
        } catch (error) {
          console.error("Failed to update last sign-in time for user:", user.uid, error);
        }
        
        const fetchedAppUser = await fetchFirestoreUser(user);
        setAppUser(fetchedAppUser);
        setUserAppRole(fetchedAppUser?.type || 'pending_setup');
      } else {
        setAppUser(null);
        setUserAppRole(null);
        setAllFirestoreUsers([]);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userAppRole === 'admin' && !isLoadingAuth) {
        fetchAllAppUsers();
    } else if (userAppRole !== 'admin') {
        setAllFirestoreUsers([]);
        setIsLoadingAllUsers(false);
    }
  }, [userAppRole, isLoadingAuth, fetchAllAppUsers]);


  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, isLoadingAuth, userAppRole, allFirestoreUsers, isLoadingAllUsers, fetchAllAppUsers, fetchAllCrmLeadsGlobally, updateAppUserProfile, changeUserPassword }}>
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
