'use server';

import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp, addDoc, collection } from 'firebase/firestore';
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
    // 1. Atualizar ou Criar no Banco de Dados
    if (data.isNewLead) {
        // Se for novo lead (ainda não existe ID, ou lógica de criação)
        // No seu caso atual, você cria o doc vazio primeiro no front, então geralmente é update.
        // Vamos assumir Update para simplificar, já que seu front gera o ID.
        await updateDoc(doc(db, 'faturas_clientes', data.leadId), {
            nome: data.leadName,
            unidades: data.unidades,
            lastUpdatedBy: { uid: data.user.uid, name: data.user.name },
            lastUpdatedAt: Timestamp.now(),
            // Se for assistente, podemos marcar uma flag de "Revisado" ou similar
        });
    } else {
        await updateDoc(doc(db, 'faturas_clientes', data.leadId), {
            unidades: data.unidades,
            lastUpdatedBy: { uid: data.user.uid, name: data.user.name },
            lastUpdatedAt: Timestamp.now()
        });
    }

    // 2. Preparar Notificação
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

<i>Banco de Dados Atualizado.</i>
    `;

    // 3. Enviar
    await sendTelegramNotification(message);

    return { success: true, message: 'Dados salvos e notificação enviada.' };

  } catch (error) {
    console.error("Erro ao salvar fatura:", error);
    return { success: false, message: 'Erro ao salvar dados.' };
  }
}