
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
import { usePathname, useRouter } from 'next/navigation';

import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { 
  BarChart3, Calculator, UsersRound, Wallet, Rocket, CircleUserRound, LogOut, 
  FileText, ShieldAlert, Loader2, Info, Network, Target, ListChecks, 
  BookOpen as TrainingIcon, Image as ImageIcon, Zap, Send, LayoutDashboard, 
  Menu, Sparkles, Trophy, UserCog
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { CommandMenu } from '@/components/ui/command-menu';
import { TermsDialog } from '@/components/auth/TermsDialog';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  isLoadingAuth: boolean;
  userAppRole: UserType | null;
  allFirestoreUsers: FirestoreUser[];
  isLoadingAllUsers: boolean;
  isImpersonating: boolean; 
  originalAdminUser: AppUser | null; 
  impersonateUser: (targetUserId: string) => Promise<void>; 
  stopImpersonating: () => Promise<void>; 
  updateAppUserProfile: (data: { displayName?: string; photoFile?: File; phone?: string; personalFinance?: FirestoreUser['personalFinance'] }) => Promise<void>;
  changeUserPassword: (currentPasswordProvided: string, newPasswordProvided: string) => Promise<void>;
  acceptUserTerms: () => Promise<void>;
  refreshUsers: () => Promise<void>; 
  fetchAllCrmLeadsGlobally: () => Promise<LeadWithId[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AppSidebar = () => {
    const { appUser, userAppRole } = useAuth();
    const { state: sidebarState } = useSidebar();
    const router = useRouter();
    const currentPathname = usePathname();

    const handleLogout = async () => {
        await signOut(auth);
        router.replace('/login');
    };

    if (!appUser) return null;

    const formatUserRole = (role: UserType | null): string => {
        const map: Record<string, string> = { 
            admin: "Administrador", superadmin: "Super Admin", vendedor: "Consultor", 
            prospector: "SDR", user: "Cliente", advogado: "Jurídico", pending_setup: "Pendente" 
        };
        return map[role || ''] || "Usuário";
    };

    const getMenuClass = (isActive: boolean) => cn(
        "transition-all duration-200 font-medium tracking-wide",
        isActive 
            ? "bg-gradient-to-r from-cyan-600/20 to-blue-600/10 text-cyan-400 border-l-2 border-cyan-500 pl-3 shadow-[0_0_15px_rgba(6,182,212,0.1)]" 
            : "text-slate-400 hover:text-white hover:bg-white/5 pl-4"
    );

    const menuIconClass = (isActive: boolean) => cn(
        "w-5 h-5 mr-3 transition-colors",
        isActive ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-slate-500 group-hover:text-slate-300"
    );

    const isAdminOrSuper = userAppRole === 'admin' || userAppRole === 'superadmin';
    const isSeller = userAppRole === 'vendedor';

    return (
        <Sidebar collapsible="icon" className="border-r border-white/5 bg-[#020617]">
            <div className="h-16 flex items-center justify-center border-b border-white/5 bg-[#020617]">
                <Link href="/hub" className="w-full flex justify-center">
                    {sidebarState === 'expanded' ? (
                        <div className="flex items-center gap-2 cursor-pointer animate-in fade-in">
                            <img src="https://raw.githubusercontent.com/lucasmouraenersim-ux/main/b0c93c3d8a644f4a5c54974a14b804bab886dcac/LOGO_LOGO_BRANCA.png" alt="Sent Energia" className="h-8 w-auto object-contain"/>
                        </div>
                    ) : (
                        <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg cursor-pointer">
                            <Zap className="h-5 w-5 text-white fill-white" />
                        </div>
                    )}
                </Link>
            </div>
            {sidebarState === 'expanded' && (
                <div className="mx-4 mt-6 p-3 rounded-xl bg-slate-900/50 border border-white/5 flex items-center gap-3 mb-2 animate-in slide-in-from-left-4 fade-in">
                    <Avatar className="h-10 w-10 border-2 border-cyan-500/30">
                        <AvatarImage src={appUser.photoURL || undefined} />
                        <AvatarFallback className="bg-slate-800 text-cyan-400 font-bold">{appUser.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                        <h2 className="text-sm font-bold text-white truncate">{appUser.displayName}</h2>
                        <p className="text-xs text-slate-400 truncate">{formatUserRole(userAppRole)}</p>
                    </div>
                </div>
            )}
            <SidebarContent className="px-2 mt-2 space-y-1 custom-scrollbar">
                <SidebarMenu>
                    <MenuSectionLabel label="Ferramentas" collapsed={sidebarState === 'collapsed'} />
                    {userAppRole !== 'advogado' && (
                        <>
                            <MenuItem href="/dashboard" icon={Calculator} label="Calculadora" active={currentPathname === '/dashboard'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            <MenuItem href="/proposal-generator" icon={FileText} label="Gerador Proposta" active={currentPathname.includes('/proposal')} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                        </>
                    )}
                    {(userAppRole === 'superadmin' || appUser.displayName?.toLowerCase() === 'jhonathas' || userAppRole === 'advogado') && (
                        <MenuItem href="/faturas" icon={FileText} label="Faturas Inteligentes" active={currentPathname === '/faturas'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                    )}
                    {userAppRole !== 'advogado' && (
                        <>
                            <MenuSectionLabel label="Comercial" collapsed={sidebarState === 'collapsed'} />
                            {isSeller && (
                                <MenuItem href="/dashboard/seller" icon={LayoutDashboard} label="Meu Painel" active={currentPathname === '/dashboard/seller'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            )}
                            {(isAdminOrSuper || appUser?.canViewCrm) && (
                                <MenuItem href="/crm" icon={UsersRound} label="CRM & Pipeline" active={currentPathname === '/crm'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            )}
                            <MenuItem href="/carteira" icon={Wallet} label="Minha Carteira" active={currentPathname === '/carteira'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            {isAdminOrSuper && (
                                <>
                                    <MenuItem href="/leads" icon={ListChecks} label="Importar Leads" active={currentPathname === '/leads'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                    <MenuItem href="/disparos" icon={Send} label="Disparos em Massa" active={currentPathname === '/disparos'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                </>
                            )}
                            <MenuSectionLabel label="Gestão" collapsed={sidebarState === 'collapsed'} />
                            {isAdminOrSuper && (
                                <>
                                    <MenuItem href="/admin/dashboard" icon={ShieldAlert} label="Painel Admin" active={currentPathname === '/admin/dashboard'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                    <MenuItem href="/admin/proposals" icon={BarChart3} label="Histórico Propostas" active={currentPathname === '/admin/proposals'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                    <MenuItem href="/admin/goals" icon={Target} label="Metas & Objetivos" active={currentPathname === '/admin/goals'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                    <MenuItem href="/admin/training" icon={TrainingIcon} label="Treinamentos" active={currentPathname === '/admin/training'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                </>
                            )}
                            <MenuItem href="/ranking" icon={Trophy} label="Ranking" active={currentPathname === '/ranking'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            {(isSeller || isAdminOrSuper) && (
                                <MenuItem href="/team" icon={Network} label="Minha Equipe" active={currentPathname === '/team'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            )}
                            {userAppRole === 'superadmin' && (
                                <MenuItem href="/photo-enhancer" icon={Sparkles} label="IA Fotos" active={currentPathname === '/photo-enhancer'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            )}
                            {appUser?.canViewCareerPlan && (
                                <MenuItem href="/plano-carreira" icon={Rocket} label="Plano de Carreira" active={currentPathname.startsWith('/plano-carreira')} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            )}
                        </>
                    )}
                    <MenuSectionLabel label="Conta" collapsed={sidebarState === 'collapsed'} />
                    <MenuItem href="/profile" icon={CircleUserRound} label="Meu Perfil" active={currentPathname === '/profile'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                    <MenuItem href="/sobre" icon={Info} label="Sobre" active={currentPathname === '/sobre'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-4 border-t border-white/5 bg-[#020617]">
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-3 transition-colors">
                    <LogOut className="h-5 w-5" />
                    {sidebarState === 'expanded' && <span className="font-medium">Sair do Sistema</span>}
                </Button>
            </SidebarFooter>
        </Sidebar>
    );
}

const MobileHeader = () => {
    const { toggleSidebar } = useSidebar();
    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-x-4 border-b border-white/5 bg-slate-950/50 backdrop-blur-md px-4 sm:px-6 md:hidden">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-white">
                <Menu className="h-6 w-6" />
            </Button>
            <span className="font-heading font-bold text-lg text-white">Sent Energia</span>
        </header>
    );
};

const MenuItem = ({ href, icon: Icon, label, active, getMenuClass, menuIconClass }: any) => (
    <SidebarMenuItem>
        <Link href={href} className="w-full block">
            <SidebarMenuButton className={cn("w-full group h-11 mb-1 transition-all", getMenuClass(active))}>
                <Icon className={menuIconClass(active)} />
                <span className="truncate">{label}</span>
            </SidebarMenuButton>
        </Link>
    </SidebarMenuItem>
);

const MenuSectionLabel = ({ label, collapsed }: { label: string, collapsed: boolean }) => {
    if (collapsed) return <div className="h-4"></div>;
    return (
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-4 py-2 mt-4 mb-1 animate-in fade-in">
            {label}
        </div>
    );
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userAppRole, setUserAppRole] = useState<AuthContextType['userAppRole']>(null);
  const [allFirestoreUsers, setAllFirestoreUsers] = useState<FirestoreUser[]>([]);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState<boolean>(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdminUser, setOriginalAdminUser] = useState<AppUser | null>(null);
  const [originalAdminToken, setOriginalAdminToken] = useState<string | null>(null);

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
          disabled: firestoreUserData.disabled
        } as AppUser;
      } else {
        console.warn(`Firestore document for user ${user.uid} not found.`);
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
      console.error("Error fetching all users:", error);
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
            if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
            if (typeof timestamp === 'string') return timestamp;
            return undefined;
        };
        return {
          id: docSnap.id,
          ...data,
          createdAt: toISOString(data.createdAt) || new Date().toISOString(),
          lastContact: toISOString(data.lastContact) || new Date().toISOString(),
          signedAt: toISOString(data.signedAt),
          completedAt: toISOString(data.completedAt),
          lastAnalyzedAt: toISOString(data.lastAnalyzedAt),
        } as LeadWithId;
      });
    } catch (error) {
      console.error("Error fetching all CRM leads globally:", error);
      return [];
    }
  }, []);
  
const impersonateUser = async (targetUserId: string) => {
    // Validação de segurança básica
    if (!appUser || !firebaseUser || (appUser.type !== 'admin' && appUser.type !== 'superadmin')) {
      toast({ title: "Erro", description: "Apenas administradores podem usar esta função.", variant: "destructive" });
      return;
    }

    try {
      // 1. Feedback visual apenas no Toast (Não bloqueia a tela inteira)
      toast({ title: "Iniciando Acesso...", description: "Preparando ambiente do usuário..." });

      // 2. Salva o Admin atual na memória para poder voltar depois
      setOriginalAdminUser(appUser);
      const token = await firebaseUser.getIdToken();
      setOriginalAdminToken(token);

      // 3. Gera o token de personificação no servidor
      const result = await generateImpersonationToken({ adminUserId: appUser.uid, targetUserId });

      if (!result.success || !result.customToken) {
        // Se falhar, limpa o estado de admin salvo para não ficar preso
        setOriginalAdminUser(null);
        setOriginalAdminToken(null);
        throw new Error(result.message || "Falha ao gerar token.");
      }

      // 4. Troca a sessão. 
      // IMPORTANTE: signInWithCustomToken faz a troca direta sem passar pelo estado "deslogado".
      // Isso evita que o app "pense" que o usuário deslogou e mande para a tela de login.
      await signInWithCustomToken(auth, result.customToken);

      // 5. Marca flag local
      setIsImpersonating(true);
      
      toast({ 
        title: "Acesso Realizado com Sucesso", 
        description: "Você está visualizando o sistema como o cliente.",
        className: "bg-yellow-500 text-black border-none"
      });

    } catch (error: any) {
      console.error("Impersonation failed:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      
      // Rollback dos estados em caso de erro
      setOriginalAdminUser(null);
      setOriginalAdminToken(null);
      setIsImpersonating(false);
    }
  };


  const stopImpersonating = async () => {
    // Se não tiver o token salvo, faz logout total por segurança
    if (!originalAdminToken) {
      await signOut(auth);
      router.replace('/login');
      return;
    }

    try {
      // 1. ATIVA O LOADING: Isso esconde a tela de "Acesso Negado" imediatamente
      setIsLoadingAuth(true);

      // 2. Loga de volta como Admin
      await signInWithCustomToken(auth, originalAdminToken);

      // 3. Limpa os estados de personificação
      setOriginalAdminUser(null);
      setOriginalAdminToken(null);
      setIsImpersonating(false);

      toast({ 
        title: "Bem-vindo de volta", 
        description: "Acesso administrativo restaurado com sucesso.",
        className: "bg-emerald-500 text-white"
      });

      // 4. Redireciona para o Dashboard Admin para garantir que saia da tela do vendedor
      router.push('/admin/dashboard');

    } catch (error) {
      console.error("Failed to stop impersonating:", error);
      toast({ title: "Sessão Expirada", description: "Por favor, faça login novamente.", variant: "destructive" });
      // Se der erro, desloga tudo para segurança
      await signOut(auth);
      router.replace('/login');
    }
    // NOTA: Não colocamos setIsLoadingAuth(false) aqui. 
    // O onAuthStateChanged vai rodar logo em seguida, detectar o Admin e desligar o loading sozinho.
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoadingAuth(true);
      if (user) {
        setFirebaseUser(user);
        const fetchedAppUser = await fetchFirestoreUser(user);
        setAppUser(fetchedAppUser);
        const role = fetchedAppUser?.type || 'pending_setup';
        setUserAppRole(role);
        if (originalAdminUser && user.uid === originalAdminUser.uid) {
            setIsImpersonating(false);
            setOriginalAdminUser(null);
            setOriginalAdminToken(null);
        } else if (originalAdminUser) {
            setIsImpersonating(true);
        }
        await refreshUsers();
        await requestNotificationPermission(user.uid);
      } else {
        setFirebaseUser(null);
        setAppUser(null);
        setUserAppRole(null);
        setAllFirestoreUsers([]);
        setIsLoadingAllUsers(false);
        setIsImpersonating(false);
        setOriginalAdminUser(null);
        setOriginalAdminToken(null);
      }
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [refreshUsers, requestNotificationPermission, originalAdminUser]);

  const contextValue = { 
    firebaseUser, appUser, isLoadingAuth, userAppRole, allFirestoreUsers, isLoadingAllUsers, 
    updateAppUserProfile, changeUserPassword, acceptUserTerms, refreshUsers, 
    fetchAllCrmLeadsGlobally, isImpersonating, impersonateUser, 
    stopImpersonating, originalAdminUser 
  };
  
  const isPublicPage = ['/login', '/register', '/', '/sobre', '/politica-de-privacidade'].includes(pathname) || pathname.startsWith('/meteorologia');

  if (isLoadingAuth && !isPublicPage) {
    return (
        <div className="flex flex-col justify-center items-center h-screen bg-[#020617] text-primary">
            <Loader2 className="animate-spin h-12 w-12 text-cyan-500" />
        </div>
    );
  }

  // If user is authenticated and not on a public page, show the main layout
  if (appUser && !isPublicPage) {
      return (
          <AuthContext.Provider value={contextValue}>
              <SidebarProvider defaultOpen={true}>
                  {isImpersonating && (
                      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2 flex items-center justify-center gap-4 text-sm font-semibold">
                          <UserCog className="w-5 h-5" />
                          <span>Você está navegando como <strong>{appUser?.displayName}</strong>.</span>
                          <Button size="sm" variant="secondary" className="h-7 bg-black/10 hover:bg-black/20 text-black" onClick={stopImpersonating}>
                              Retornar para Admin ({originalAdminUser?.displayName})
                          </Button>
                      </div>
                  )}
                  <AppSidebar />
                  <div className="relative flex min-h-svh flex-1 flex-col peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow bg-[#020617] overflow-hidden">
                      <div className="fixed inset-0 z-0 pointer-events-none">
                          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] animate-float"></div>
                          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] animate-float" style={{animationDelay: '2s'}}></div>
                      </div>
                      <MobileHeader />
                      <main className="relative z-10 flex-1 overflow-auto h-full">
                          {children}
                      </main>
                  </div>
                  <TermsDialogWrapper />
                  <CommandMenu />
              </SidebarProvider>
          </AuthContext.Provider>
      )
  }

  // For public pages or unauthenticated users
  return (
    <AuthContext.Provider value={contextValue}>
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

const TermsDialogWrapper = () => {
    const { appUser, acceptUserTerms } = useAuth();
    if (!appUser) return null;
    return <TermsDialog isOpen={!appUser.termsAcceptedAt} onAccept={acceptUserTerms} />;
};

    