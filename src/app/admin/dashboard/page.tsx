
"use client";

import { Suspense, useEffect } from 'react';
import AdminCommissionDashboard from '@/components/admin/AdminCommissionDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldCheck, Send } from 'lucide-react';
import type { AppUser } from '@/types/user';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { sendFCMNotification } from '@/actions/notifications/sendFCMNotification';

export default function AdminDashboardPage() {
  const { appUser, isLoadingAuth, userAppRole, allFirestoreUsers, isLoadingAllUsers, refreshUsers } = useAuth();
  const { toast } = useToast();

  // Effect to fetch users if admin is already logged in but allFirestoreUsers might not be populated initially
  useEffect(() => {
    if ((userAppRole === 'admin' || userAppRole === 'superadmin') && !isLoadingAllUsers && allFirestoreUsers.length === 0) {
      refreshUsers();
    }
  }, [userAppRole, isLoadingAllUsers, allFirestoreUsers.length, refreshUsers]);

  const handleTestNotification = async () => {
    toast({ title: 'Enviando Notificação de Teste...', description: 'Aguarde um momento.' });
    const result = await sendFCMNotification({
      title: 'Notificação de Teste 🧪',
      body: 'Se você recebeu isto, o FCM está funcionando corretamente!',
      targetRole: 'superadmin',
    });
    if (result.success && result.successCount > 0) {
      toast({ title: 'Sucesso!', description: `${result.successCount} notificação(ões) de teste enviada(s).` });
    } else {
      toast({ title: 'Falha no Envio', description: result.error || 'Nenhum token de superadmin encontrado.', variant: 'destructive' });
    }
  };


  if (isLoadingAuth || ((userAppRole === 'admin' || userAppRole === 'superadmin') && isLoadingAllUsers)) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando dados do administrador...</p>
      </div>
    );
  }

  if ((userAppRole !== 'admin' && userAppRole !== 'superadmin') || !appUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-destructive">
        <ShieldCheck size={64} className="mb-4" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p>Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
        <p className="text-lg font-medium">Carregando Painel do Administrador...</p>
      </div>
    }>
      {/* Botão de Teste de Notificação */}
      <div className="p-4 m-4 border rounded-lg bg-card/70">
        <h3 className="font-semibold text-lg text-primary">Teste de Notificação Push</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Clique no botão abaixo para enviar uma notificação de teste para todos os Super Admins que permitiram notificações.
        </p>
        <Button onClick={handleTestNotification}>
          <Send className="mr-2 h-4 w-4" />
          Enviar Notificação de Teste
        </Button>
      </div>

      <AdminCommissionDashboard
        loggedInUser={appUser as AppUser}
        initialUsers={allFirestoreUsers}
        isLoadingUsersProp={isLoadingAllUsers}
        onUsersChange={refreshUsers}
      />
    </Suspense>
  );
}
