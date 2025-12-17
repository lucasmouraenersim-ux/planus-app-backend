
"use server";
import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp, addDoc, collection } from "firebase/firestore";
import type { WithdrawalRequestData, PixKeyType, WithdrawalType } from '@/types/wallet';

interface RequestWithdrawalParams {
    userId: string;
    amount: number;
    pixKeyType: PixKeyType;
    pixKey: string;
    withdrawalType: WithdrawalType;
}

export async function requestWithdrawalAction({ userId, amount, pixKeyType, pixKey, withdrawalType }: RequestWithdrawalParams): Promise<{ success: boolean; message: string }> {
    if (!userId || !amount || !pixKey || !pixKeyType) {
        return { success: false, message: "Dados inválidos para solicitação de saque." };
    }
    
    if (amount < 50) {
        return { success: false, message: "O valor mínimo para saque é de R$ 50,00." };
    }

    const userRef = doc(db, "users", userId);

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw new Error("Usuário não encontrado.");
            }

            const userData = userDoc.data();
            const currentBalance = withdrawalType === 'personal' 
                ? userData.personalBalance || 0 
                : userData.mlmBalance || 0;

            if (currentBalance < amount) {
                throw new Error("Saldo insuficiente para realizar o saque.");
            }

            const balanceFieldToUpdate = withdrawalType === 'personal' ? 'personalBalance' : 'mlmBalance';
            
            // 1. Deduz o valor do saldo IMEDIATAMENTE (para evitar solicitações duplicadas)
            transaction.update(userRef, {
                [balanceFieldToUpdate]: currentBalance - amount
            });

            // 2. Cria o registro da solicitação de saque pendente para o admin aprovar
            const newRequest: Omit<WithdrawalRequestData, 'requestedAt'> = {
                userId,
                userName: userData.displayName || 'Nome não informado',
                userEmail: userData.email || 'Email não informado',
                amount,
                pixKeyType,
                pixKey,
                status: 'pendente',
                withdrawalType,
                requestedAt: serverTimestamp() as any, // serverTimestamp will be converted on the server
            };
            
            await addDoc(collection(db, "withdrawal_requests"), newRequest);
        });

        return { success: true, message: "Sua solicitação de saque foi enviada com sucesso e está aguardando aprovação." };

    } catch (error: any) {
        console.error("Erro na transação de saque:", error);
        return { success: false, message: error.message || "Ocorreu um erro ao processar sua solicitação." };
    }
}
