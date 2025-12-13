'use server';

import { db } from '@/lib/firebase';
import { doc, runTransaction, Timestamp, collection } from 'firebase/firestore';
// Importamos o carteiro que acabamos de criar
import { sendTelegramNotification } from '@/lib/telegram';

const PROPOSAL_COST = 2; // Custo em créditos

export async function saveProposalAction(proposalData: any, userId: string, userRole: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const counterRef = doc(db, 'counters', 'proposals');
    const proposalsRef = collection(db, 'proposals');

    let proposalNumber = 0;

    // 1. Executa a transação no Banco de Dados
    await runTransaction(db, async (transaction) => {
      // Verifica Créditos (Se não for Admin)
      if (userRole !== 'superadmin' && userRole !== 'admin') {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "Usuário não encontrado";
        
        const currentCredits = userDoc.data().credits || 0;
        if (currentCredits < PROPOSAL_COST) {
          throw "Saldo insuficiente para gerar proposta.";
        }
        transaction.update(userRef, { credits: currentCredits - PROPOSAL_COST });
      }

      // Gera ID Sequencial (Proposta #1, #2...)
      const counterDoc = await transaction.get(counterRef);
      let currentCount = 0;
      if (counterDoc.exists()) {
        currentCount = counterDoc.data().count || 0;
      }
      proposalNumber = currentCount + 1;
      transaction.set(counterRef, { count: proposalNumber }, { merge: true });

      // Salva a Proposta
      const newProposalRef = doc(proposalsRef);
      transaction.set(newProposalRef, {
        ...proposalData,
        proposalNumber: proposalNumber,
        userId: userId,
        createdAt: Timestamp.now(),
        status: 'Gerada'
      });
    });

    // 2. DISPARA A NOTIFICAÇÃO NO TELEGRAM (A Mágica)
    try {
        // Formata valores para moeda brasileira
        const valorFormatado = Number(proposalData.currentTariff).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        const economiaAnual = (Number(proposalData.item1Quantidade) * Number(proposalData.currentTariff) * 12 * (Number(proposalData.desconto)/100)).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

        const message = `
🚀 <b>Nova Proposta Gerada! (#${proposalNumber})</b>

👤 <b>Promotor:</b> ${proposalData.generatorName || 'Usuário'}
🏢 <b>Cliente:</b> ${proposalData.clienteNome}
⚡ <b>Consumo:</b> ${proposalData.item1Quantidade} kWh
💲 <b>Tarifa:</b> ${valorFormatado}
💰 <b>Economia Est.:</b> ${economiaAnual}/ano
🏷️ <b>Parceiro:</b> ${proposalData.comercializadora}
📍 <b>Local:</b> ${proposalData.clienteCidade || 'N/A'}

<i>Verifique o painel administrativo para mais detalhes.</i>
        `;
        
        // Envia sem esperar (para não travar o site do usuário)
        sendTelegramNotification(message);
    } catch (notifyError) {
        console.error("Falha ao notificar telegram (não afetou o salvamento)", notifyError);
    }

    return { success: true, proposalNumber, message: 'Proposta salva com sucesso!' };

  } catch (error: any) {
    console.error("Erro ao salvar proposta:", error);
    return { success: false, message: typeof error === 'string' ? error : 'Erro interno.' };
  }
}
