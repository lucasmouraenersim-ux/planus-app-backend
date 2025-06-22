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

    // Validação mais detalhada para garantir que temos uma mensagem
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    
    if (message) {
        console.log('[WHATSAPP_WEBHOOK] Objeto de mensagem encontrado.');
        
        if (message.type === 'text') {
            const messageData = body.entry[0].changes[0].value;
            const from = message.from; // Número de telefone do remetente
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
    } else {
        console.log('[WHATSAPP_WEBHOOK] Payload não contém uma mensagem de usuário padrão. Ignorando. (Isso pode ser uma notificação de status de entrega, etc.)');
    }
    
    console.log('[WHATSAPP_WEBHOOK] Respondendo 200 OK para a API da Meta.');
    return NextResponse.json({ status: "success" }, { status: 200 });

  } catch (error) {
    console.error('[WHATSAPP_WEBHOOK] ERRO CRÍTICO no processamento do webhook:', error);
    // Mesmo em caso de erro, é importante responder 200 para a Meta
    return NextResponse.json({ message: "Erro interno no servidor, mas a notificação foi recebida." }, { status: 200 });
  }
}
