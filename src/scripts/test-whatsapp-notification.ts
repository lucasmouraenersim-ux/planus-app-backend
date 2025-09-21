'use server';
/**
 * @fileoverview Script de teste para enviar uma notificação de WhatsApp.
 * Este script pode ser executado a partir do terminal para verificar a funcionalidade de envio de mensagens.
 */

import { sendWhatsappMessage } from '@/actions/whatsapp/sendWhatsappMessage';

async function testWhatsappNotification() {
  console.log("Iniciando teste de notificação do WhatsApp...");

  // O número de telefone para o qual a notificação será enviada.
  const adminPhoneNumber = "65981390777"; 
  
  // Dados de exemplo para o teste
  const promoterName = "Usuário de Teste";
  const score = 95.5;

  const message = `🔔 *Alerta de Treinamento Concluído (TESTE)* 🔔\n\nO promotor *${promoterName}* finalizou o questionário de treinamento com uma pontuação de *${score.toFixed(1)}%*.`;

  try {
    const result = await sendWhatsappMessage({
      to: adminPhoneNumber,
      message: { text: message }
    });

    if (result.success) {
      console.log("\n✅ Teste bem-sucedido!");
      console.log(`   Mensagem enviada para ${adminPhoneNumber}.`);
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.error("\n❌ Teste falhou.");
      console.error(`   Erro ao enviar para ${adminPhoneNumber}:`, result.error);
    }
  } catch (error) {
    console.error("\n❌ Erro crítico durante o teste:", error);
  }
}

// Executa a função de teste
testWhatsappNotification();
