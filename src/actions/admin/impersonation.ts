
'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function generateImpersonationToken({ adminUserId, targetUserId }: { adminUserId: string, targetUserId: string }) {
  console.log(`🕵️ [Impersonate] Admin ${adminUserId} tentando acessar ${targetUserId}`);

  try {
    // 1. Inicializa Admin SDK
    const { app } = await initializeAdmin();
    const adminAuth = getAuth(app);
    const adminDb = getFirestore(app);

    // 2. VERIFICAÇÃO DE SEGURANÇA (Onde estava o erro)
    // Busca os dados de quem está PEDINDO o acesso (Você)
    const adminUserDoc = await adminDb.collection('users').doc(adminUserId).get();
    
    if (!adminUserDoc.exists) {
        return { success: false, message: "Usuário administrador não encontrado no banco de dados." };
    }

    const adminData = adminUserDoc.data();
    const userRole = adminData?.type;

    console.log(`👤 Role do solicitante: ${userRole}`);

    // AQUI ESTÁ A CORREÇÃO: Aceitar 'admin' OU 'superadmin'
    if (userRole !== 'admin' && userRole !== 'superadmin') {
        // Failsafe: Se for o seu email hardcoded, libera mesmo se o banco estiver errado
        const email = adminData?.email;
        const isMasterEmail = email === 'lucasmoura@sentenergia.com' || email === 'lucasmourafoto@sentenergia.com';
        
        if (!isMasterEmail) {
            return { success: false, message: "Permissão negada. Apenas administradores podem personificar usuários." };
        }
    }

    // 3. Gera o Token Customizado para o Alvo
    // Adicionamos claims extras para o sistema saber que é uma personificação
    const customToken = await adminAuth.createCustomToken(targetUserId, {
      impersonated: true,
      originalAdminId: adminUserId,
      role: 'impersonated_user' 
    });

    console.log("✅ Token de personificação gerado com sucesso.");
    
    return { success: true, customToken };

  } catch (error: any) {
    console.error("❌ [Impersonate Error]:", error);
    return { success: false, message: error.message || "Erro interno ao gerar token." };
  }
}
