'use server';

import { db } from '@/lib/firebase';
import { doc, runTransaction, Timestamp, collection } from 'firebase/firestore';
import { sendTelegramNotification } from '@/lib/telegram';

const PROPOSAL_COST = 2;

// Função auxiliar para limpar números (converte "1.500,00" ou "0,98" para numero real)
const parseNumber = (value: any) => {
  if (!value) return 0;
  const str = String(value);
  // Se tiver vírgula, assume formato BR: remove ponto de milhar e troca virgula por ponto
  if (str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(str);
};

export async function saveProposalAction(proposalData: any, userId: string, userRole: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const counterRef = doc(db, 'counters', 'proposals');
    const proposalsRef = collection(db, 'proposals');

    let proposalNumber = 0;

    // 1. Transação no Banco de Dados
    await runTransaction(db, async (transaction) => {
      // Verifica Créditos
      if (userRole !== 'superadmin' && userRole !== 'admin') {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "Usuário não encontrado";
        
        const currentCredits = userDoc.data().credits || 0;
        if (currentCredits < PROPOSAL_COST) {
          throw "Saldo insuficiente para gerar proposta.";
        }
        transaction.update(userRef, { credits: currentCredits - PROPOSAL_COST });
      }

      // Gera ID Sequencial
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

    // 2. Notificação Telegram
    try {
        // Conversão Segura dos Números
        const consumo = parseNumber(proposalData.item1Quantidade);
        const tarifa = parseNumber(proposalData.currentTariff);
        const desconto = parseNumber(proposalData.desconto);
        
        // Cálculo da Economia Anual: Consumo * Tarifa * 12 Meses * %Desconto
        const economiaValor = consumo * tarifa * 12 * (desconto / 100);

        // Formatação para BRL (R$ 1.200,00)
        const economiaFormatada = economiaValor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        const tarifaFormatada = tarifa.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

        const message = `
🚀 <b>Nova Proposta Gerada! (#${proposalNumber})</b>

👤 <b>Promotor:</b> ${proposalData.generatorName || 'N/A'}
🏢 <b>Cliente:</b> ${proposalData.clienteNome}
📱 <b>Tel:</b> ${proposalData.clienteTelefone || 'Não informado'}

⚡ <b>Consumo:</b> ${consumo.toLocaleString('pt-BR')} kWh
💲 <b>Tarifa:</b> ${tarifaFormatada}
📉 <b>Desconto:</b> ${desconto}%
💰 <b>Economia Est.:</b> ${economiaFormatada}/ano

🏷️ <b>Parceiro:</b> ${proposalData.comercializadora}
📍 <b>Local:</b> ${proposalData.clienteCidade || ''}/${proposalData.clienteUF || ''}

<i>Verifique o painel administrativo para mais detalhes.</i>
        `;
        
        await sendTelegramNotification(message);
    } catch (notifyError) {
        console.error("Falha ao notificar telegram", notifyError);
    }

    return { success: true, proposalNumber, message: 'Proposta salva com sucesso!' };

  } catch (error: any) {
    console.error("Erro ao salvar proposta:", error);
    return { success: false, message: typeof error === 'string' ? error : 'Erro interno.' };
  }
}
