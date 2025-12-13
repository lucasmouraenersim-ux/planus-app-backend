'use server';

import { db } from '@/lib/firebase';
import { doc, runTransaction, Timestamp, collection, addDoc } from 'firebase/firestore';

const PROPOSAL_COST = 2; // Custo em créditos

export async function saveProposalAction(proposalData: any, userId: string, userRole: string) {
  try {
    // Referências
    const userRef = doc(db, 'users', userId);
    const counterRef = doc(db, 'counters', 'proposals'); // Documento que guarda o número atual
    const proposalsRef = collection(db, 'proposals');

    let proposalNumber = 0;

    // Usamos Transaction para garantir que o ID seja único e sequencial mesmo com vários acessos simultâneos
    await runTransaction(db, async (transaction) => {
      // 1. Verificar Créditos (Se não for Admin)
      if (userRole !== 'superadmin' && userRole !== 'admin') {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "Usuário não encontrado";
        
        const currentCredits = userDoc.data().credits || 0;
        if (currentCredits < PROPOSAL_COST) {
          throw "Saldo insuficiente para gerar proposta.";
        }
        
        // Descontar créditos
        transaction.update(userRef, { credits: currentCredits - PROPOSAL_COST });
        
        // Logar transação (opcional, recomendado fazer em outra chamada para não pesar a transação)
      }

      // 2. Gerar ID Sequencial
      const counterDoc = await transaction.get(counterRef);
      let currentCount = 0;
      if (counterDoc.exists()) {
        currentCount = counterDoc.data().count || 0;
      }
      
      proposalNumber = currentCount + 1;
      
      // Atualizar contador
      transaction.set(counterRef, { count: proposalNumber }, { merge: true });

      // 3. Salvar Proposta
      const newProposalRef = doc(proposalsRef); // Gera ID aleatório do doc
      transaction.set(newProposalRef, {
        ...proposalData,
        proposalNumber: proposalNumber, // O número bonito (1, 2, 3...)
        userId: userId,
        createdAt: Timestamp.now(),
        status: 'Gerada'
      });
    });

    return { success: true, proposalNumber, message: 'Proposta salva com sucesso!' };

  } catch (error: any) {
    console.error("Erro ao salvar proposta:", error);
    return { success: false, message: typeof error === 'string' ? error : 'Erro interno.' };
  }
}
