'use server';

import { db } from '@/lib/firebase';
import { updateCrmLeadDetails, createCrmLead } from '@/lib/firebase/firestore'; // Importar as novas funções do CRM
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { sendTelegramNotification } from '@/lib/telegram';

export async function registerInvoiceAction(data: {
  leadId: string;
  leadName: string;
  isNewLead: boolean;
  unidades: any[];
  user: { uid: string; name: string; role: string };
  aiData?: any; // Dados lidos pela IA (opcional)
}) {
  try {
    // 1. Atualizar ou Criar Lead no CRM principal (`crm_leads`)
    const leadDataForCrm = {
      name: data.leadName,
      kwh: data.aiData?.consumoKwh ? parseInt(String(data.aiData.consumoKwh).replace(/\D/g, ''), 10) : undefined,
      value: data.aiData?.valorTotal,
      uf: data.aiData?.estado,
      phone: data.aiData?.telefone, // Supondo que a IA possa extrair o telefone
      // Adicione outros campos que a IA extrai e que são relevantes para o CRM
    };

    // Remove chaves com valor undefined
    Object.keys(leadDataForCrm).forEach(key => (leadDataForCrm as any)[key] === undefined && delete (leadDataForCrm as any)[key]);

    if (data.isNewLead) {
       // Se for realmente um novo lead, você pode querer chamar createCrmLead.
       // No entanto, o fluxo atual cria o doc primeiro no front, então update é mais comum.
       // Vamos manter o update, mas o ideal seria unificar a criação. Por agora, atualizamos o que foi criado.
       await updateCrmLeadDetails(data.leadId, leadDataForCrm);
    } else {
       await updateCrmLeadDetails(data.leadId, leadDataForCrm);
    }

    // 2. Lógica Antiga: Atualizar `faturas_clientes` (Podemos manter por compatibilidade ou remover no futuro)
    const faturaRef = doc(db, 'faturas_clientes', data.leadId);
    await updateDoc(faturaRef, {
        nome: data.leadName,
        unidades: data.unidades,
        lastUpdatedBy: { uid: data.user.uid, name: data.user.name },
        lastUpdatedAt: Timestamp.now(),
        // Se for assistente, podemos marcar uma flag de "Revisado" ou similar
    });


    // 3. Preparar Notificação (Mantido)
    const consumo = data.aiData?.consumoKwh || data.unidades[0]?.consumoKwh || '0';
    const cidade = data.aiData?.cidade || data.unidades[0]?.cidade || 'N/A';
    
    // Identifica se é o Assistente (Advogado/Faturas)
    const cargo = data.user.role === 'advogado' ? '👨‍💼 Assistente' : '👤 Usuário';

    const message = `
📄 <b>Nova Fatura Cadastrada/Atualizada</b>

${cargo}: <b>${data.user.name}</b>
🏢 <b>Cliente:</b> ${data.leadName}
⚡ <b>Consumo:</b> ${consumo} kWh
📍 <b>Cidade:</b> ${cidade}
🤖 <b>IA Usada:</b> ${data.aiData ? 'Sim' : 'Não'}

<i>Lead criado/atualizado no CRM.</i>
    `;

    // 4. Enviar (Mantido)
    await sendTelegramNotification(message);

    return { success: true, message: 'Dados salvos, CRM atualizado e notificação enviada.' };

  } catch (error) {
    console.error("Erro ao salvar fatura:", error);
    return { success: false, message: 'Erro ao salvar dados.' };
  }
}
