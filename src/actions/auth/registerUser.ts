
'use server';
/**
 * @fileOverview A server action to register a new user.
 * This action handles both Firebase Authentication user creation and
 * the corresponding Firestore document creation.
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import { initializeAdmin } from '@/lib/firebase/admin';
import type { UserType, FirestoreUser } from '@/types/user';

// Zod schema for input validation
const RegisterUserInputSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres."),
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
});
export type RegisterUserInput = z.infer<typeof RegisterUserInputSchema>;

const RegisterUserOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  userId: z.string().optional(),
});
export type RegisterUserOutput = z.infer<typeof RegisterUserOutputSchema>;

export async function registerUser(input: RegisterUserInput): Promise<RegisterUserOutput> {
  try {
    const { db: adminDb, auth: adminAuth } = await initializeAdmin();

    // 1. Check if email is already in use
    try {
      await adminAuth.getUserByEmail(input.email);
      return { success: false, message: "Este email já está em uso." };
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error; // Re-throw unexpected errors
      }
      // If user not found, continue. This is the expected case.
    }

    // 2. Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
      emailVerified: true, // Automatically verify email for simplicity
    });

    // 3. Create user document in Firestore with 'vendedor' as default type and 'pending_docs' status
    const newUserForFirestore: Omit<FirestoreUser, 'uid'> = {
      email: input.email,
      displayName: input.name,
      type: 'vendedor' as UserType, // Default new users to 'vendedor'
      status: 'pending_docs', // Start with pending documents status
      createdAt: admin.firestore.Timestamp.now() as any,
      photoURL: `https://placehold.co/40x40.png?text=${input.name.charAt(0).toUpperCase()}`,
      phone: '',
      personalBalance: 0,
      mlmBalance: 0,
      canViewLeadPhoneNumber: false,
      canViewCrm: false,
      canViewCareerPlan: true,
      assignmentLimit: 2,
    };
    
    await adminDb.collection("users").doc(userRecord.uid).set(newUserForFirestore);

    return {
      success: true,
      message: `Usuário ${input.email} criado com sucesso. Complete seu cadastro.`,
      userId: userRecord.uid,
    };

  } catch (error: any) {
    console.error("[REGISTER_USER_ACTION] Critical error:", error);
    let message = "Ocorreu um erro inesperado ao registrar o usuário.";
    if (error.code === 'auth/email-already-exists') {
      message = "Este email já está em uso.";
    } else if (error.code === 'auth/invalid-password') {
      message = "A senha fornecida é inválida. Deve ter pelo menos 6 caracteres.";
    }
    return { success: false, message };
  }
}
