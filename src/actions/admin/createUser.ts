
'use server';
/**
 * @fileOverview A server action for an administrator to create a new user.
 * This action handles both Firebase Authentication user creation and
 * the corresponding Firestore document creation.
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import { initializeAdmin } from '@/lib/firebase/admin';
import type { UserType, FirestoreUser } from '@/types/user';

// Zod schema for input validation
const CreateUserInputSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  documento: z.string().min(11, "CPF/CNPJ deve ter pelo menos 11 dígitos.").max(18, "Formato de CPF/CNPJ inválido."),
  type: z.enum(['admin', 'superadmin', 'vendedor', 'prospector', 'advogado']),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

const CreateUserOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  userId: z.string().optional(),
});
export type CreateUserOutput = z.infer<typeof CreateUserOutputSchema>;

export async function createUser(input: CreateUserInput): Promise<CreateUserOutput> {
  try {
    const { db: adminDb, auth: adminAuth } = await initializeAdmin();

    // 1. Check for existing email in Auth
    try {
      await adminAuth.getUserByEmail(input.email);
      return { success: false, message: "Este email já está em uso." };
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error; // Re-throw unexpected errors
      }
      // If user not found, continue. This is the expected case.
    }

    // 2. Check for existing CPF/CNPJ in Firestore
    const normalizedDoc = (input.documento || '').replace(/\D/g, '');
    const usersRef = adminDb.collection("users");
    
    if (normalizedDoc) {
        let docQuery;
        if (normalizedDoc.length === 11) {
            docQuery = usersRef.where("cpf", "==", normalizedDoc).limit(1);
        } else if (normalizedDoc.length === 14) {
            docQuery = usersRef.where("cnpj", "==", normalizedDoc).limit(1);
        } else {
            return { success: false, message: "Formato de documento inválido." };
        }

        const docSnapshot = await docQuery.get();
        if (!docSnapshot.empty) {
          return { success: false, message: "Este CPF/CNPJ já está cadastrado." };
        }
    } else {
        return { success: false, message: "CPF/CNPJ é obrigatório." };
    }


    // 3. Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName || input.email.split('@')[0],
      emailVerified: true, // Or false, depending on your flow
    });

    const isSuperAdminEmail = input.email === 'lucasmoura@sentenergia.com' || input.email === 'lucasmourafoto@sentenergia.com';
    const finalUserType = isSuperAdminEmail ? 'superadmin' : input.type;


    // 4. Create user document in Firestore
    const newUserForFirestore: Omit<FirestoreUser, 'uid' | 'cpf' | 'cnpj'> & { cpf?: string, cnpj?: string } = {
      email: input.email,
      displayName: userRecord.displayName || input.email.split('@')[0],
      type: finalUserType as UserType,
      createdAt: admin.firestore.Timestamp.now() as any,
      photoURL: `https://placehold.co/40x40.png?text=${(userRecord.displayName || input.email).charAt(0).toUpperCase()}`,
      phone: (input as any).phone ? (input as any).phone.replace(/\D/g, '') : '',
      personalBalance: 0,
      mlmBalance: 0,
      commissionRate: 40,
      canViewLeadPhoneNumber: finalUserType === 'advogado',
      canViewCrm: true, // Garante que o advogado tenha a flag canViewCrm
      canViewCareerPlan: !isSuperAdminEmail,
      assignmentLimit: 2, // Default limit for new users
    };

    // Conditionally add cpf or cnpj to avoid 'undefined' values
    if (normalizedDoc.length === 11) {
      newUserForFirestore.cpf = normalizedDoc;
    } else if (normalizedDoc.length === 14) {
      newUserForFirestore.cnpj = normalizedDoc;
    }
    
    await adminDb.collection("users").doc(userRecord.uid).set(newUserForFirestore);
    
    if (isSuperAdminEmail) {
      await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'superadmin' });
    }


    return {
      success: true,
      message: `Usuário ${input.email} criado com sucesso.`,
      userId: userRecord.uid,
    };

  } catch (error: any) {
    console.error("[CREATE_USER_ACTION] Critical error:", error);
    let message = "Ocorreu um erro inesperado ao criar o usuário.";
    if (error instanceof Error && error.message.includes('Firestore document')) {
        message = `Erro de banco de dados: ${error.message}`;
    } else if (error.code === 'auth/email-already-exists') {
      message = "Este email já está em uso.";
    } else if (error.code === 'auth/invalid-password') {
      message = "A senha fornecida é inválida. Deve ter pelo menos 6 caracteres.";
    }
    return { success: false, message: message };
  }
}
