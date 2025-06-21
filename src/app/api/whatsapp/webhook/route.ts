
// src/app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createLeadFromWhatsapp } from '@/lib/firebase/firestore';

// O token que você configurou no painel de desenvolvedores da Meta
const VERIFY_TOKEN = "testeapi";

/**
 * Handles the webhook verification GET request from Meta.
 */
export async function GET(request: NextRequest) {
  console.log('[WHATSAPP_VERIFY] Recebida requisição GET para verificação do webhook.');
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WHATSAPP_VERIFY] Verificação bem-sucedida! Respondendo com o "challenge".');
    return new Response(challenge, { status: 200 });
  } else {
    console.error('[WHATSAPP_VERIFY] FALHA na verificação. "Mode" ou "token" não correspondem.');
    return new Response('Forbidden', { status: 403 });
  }
}

/**
 * Handles incoming message notifications POST requests from Meta.
 */
export async function POST(request: NextRequest) {
  console.log('[WHATSAPP_MESSAGE] Recebida requisição POST (nova mensagem ou evento).');
  try {
    const body = await request.json();
    console.log('[WHATSAPP_MESSAGE] Payload recebido:', JSON.stringify(body, null, 2));

    // Validação básica para garantir que é um evento de mensagem do WhatsApp
    if (body.object === 'whatsapp_business_account' && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const messageData = body.entry[0].changes[0].value;
      const message = messageData.messages[0];
      
      // Processar apenas mensagens de texto
      if (message.type === 'text') {
        const from = message.from; // Número de telefone do remetente
        const text = message.text.body;
        const profileName = messageData.contacts?.[0]?.profile?.name || 'Lead do WhatsApp';

        console.log(`[WHATSAPP_MESSAGE] Processando mensagem de texto de: ${profileName} (${from}).`);
        
        console.log(`[WHATSAPP_LEAD_CREATION] Tentando criar novo lead a partir da mensagem...`);
        const newLeadId = await createLeadFromWhatsapp(profileName, from, text);
        
        if (newLeadId) {
          console.log(`[WHATSAPP_LEAD_CREATION] Sucesso! Lead criado com o ID: ${newLeadId}`);
        } else {
          console.error(`[WHATSAPP_LEAD_CREATION] Falha ao criar o lead para o número ${from}.`);
        }
      } else {
        console.log(`[WHATSAPP_MESSAGE] Ignorando mensagem que não é de texto (tipo: ${message.type}).`);
      }
    } else {
      console.log('[WHATSAPP_MESSAGE] Evento recebido não é uma mensagem de usuário padrão (ex: atualização de status). Ignorando.');
    }
    
    // É crucial responder 200 OK para a Meta rapidamente.
    return NextResponse.json({ status: "success" }, { status: 200 });

  } catch (error) {
    console.error('[WHATSAPP_FATAL] Erro crítico ao processar o webhook:', error);
    // Sempre retorne 200 para evitar que a Meta desative o webhook por falhas.
    return NextResponse.json({ message: "Erro interno, mas a notificação foi recebida." }, { status: 200 });
  }
}
