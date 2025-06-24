
// src/app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createLeadFromWhatsapp } from '@/lib/firebase/firestore';

// O token que você configurou no painel de desenvolvedores da Meta
const VERIFY_TOKEN = "testeapi";

/**
 * Handles the webhook verification GET request from Meta.
 */
export async function GET(request: NextRequest) {
  console.log('[WHATSAPP_VERIFY] INICIANDO verificação de webhook.');
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  console.log(`[WHATSAPP_VERIFY] Modo: ${mode}, Token: ${token ? 'presente' : 'ausente'}, Challenge: ${challenge ? 'presente' : 'ausente'}`);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WHATSAPP_VERIFY] SUCESSO! Token e modo são válidos. Respondendo com o challenge.');
    return new Response(challenge, { status: 200 });
  } else {
    console.error('[WHATSAPP_VERIFY] FALHA na verificação. Token ou modo inválidos.');
    return new Response('Forbidden', { status: 403 });
  }
}

/**
 * Handles incoming message notifications POST requests from Meta.
 */
export async function POST(request: NextRequest) {
  console.log('--- [WHATSAPP_WEBHOOK] Nova requisição POST recebida ---');
  try {
    const body = await request.json();
    console.log('[WHATSAPP_WEBHOOK] Payload completo recebido:', JSON.stringify(body, null, 2));

    const change = body?.entry?.[0]?.changes?.[0];

    if (change?.field === 'messages') {
      const value = change.value;
      
      // Handle incoming user messages
      const message = value?.messages?.[0];
      if (message) {
        console.log('[WHATSAPP_WEBHOOK] Objeto de mensagem de usuário encontrado.');
        if (message.type === 'text') {
            const messageData = value; // value is the correct scope here
            const from = message.from;
            const text = message.text.body;
            const profileName = messageData.contacts?.[0]?.profile?.name || 'Lead do WhatsApp';

            console.log(`[WHATSAPP_WEBHOOK] MENSAGEM DE TEXTO: De '${profileName}' (${from}). Conteúdo: "${text}"`);
            
            console.log('[WHATSAPP_WEBHOOK] Chamando a função createLeadFromWhatsapp...');
            const newLeadId = await createLeadFromWhatsapp(profileName, from, text);
            
            if (newLeadId) {
                console.log(`[WHATSAPP_WEBHOOK] SUCESSO: Função createLeadFromWhatsapp retornou o ID do lead: ${newLeadId}`);
            } else {
                console.error(`[WHATSAPP_WEBHOOK] FALHA: Função createLeadFromWhatsapp não retornou um ID para o número ${from}. Verifique os logs da função.`);
            }
        } else {
            console.log(`[WHATSAPP_WEBHOOK] Mensagem de tipo '${message.type}' recebida e ignorada.`);
        }
      }

      // Handle message status updates (sent, delivered, failed, etc.)
      const status = value?.statuses?.[0];
      if (status) {
          console.log(`[WHATSAPP_WEBHOOK_STATUS] Status de mensagem recebido:`);
          console.log(`[WHATSAPP_WEBHOOK_STATUS] Message ID: ${status.id}`);
          console.log(`[WHATSAPP_WEBHOOK_STATUS] Recipient: ${status.recipient_id}`);
          console.log(`[WHATSAPP_WEBHOOK_STATUS] Status: ${status.status}`);
          
          if (status.status === 'failed' && status.errors) {
              console.error(`[WHATSAPP_WEBHOOK_STATUS] ERRO: A mensagem falhou ao ser entregue.`);
              status.errors.forEach((error: any) => {
                  console.error(`[WHATSAPP_WEBHOOK_STATUS] Código de Erro: ${error.code}`);
                  console.error(`[WHATSAPP_WEBHOOK_STATUS] Título do Erro: ${error.title}`);
                  if (error.error_data?.details) {
                    console.error(`[WHATSAPP_WEBHOOK_STATUS] Detalhes: ${error.error_data.details}`);
                  }
              });
          }
      }

      if (!message && !status) {
        console.log('[WHATSAPP_WEBHOOK] Notificação recebida não é uma mensagem de usuário nem um status. Ignorando.');
      }
    } else {
        console.log('[WHATSAPP_WEBHOOK] Payload não é uma notificação de mensagem. Ignorando.');
    }
    
    console.log('[WHATSAPP_WEBHOOK] Respondendo 200 OK para a API da Meta.');
    return NextResponse.json({ status: "success" }, { status: 200 });

  } catch (error) {
    console.error('[WHATSAPP_WEBHOOK] ERRO CRÍTICO no processamento do webhook:', error);
    // Mesmo em caso de erro, é importante responder 200 para a Meta
    return NextResponse.json({ message: "Erro interno no servidor, mas a notificação foi recebida." }, { status: 200 });
  }
}
