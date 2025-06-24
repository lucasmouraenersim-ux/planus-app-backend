// src/app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

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
  console.log('--- [WHATSAPP_WEBHOOK] Nova requisição POST recebida (Modo de Recuperação) ---');
  try {
    const body = await request.json();
    console.log('[WHATSAPP_WEBHOOK] Payload completo recebido:', JSON.stringify(body, null, 2));

    // A lógica de processamento foi temporariamente desativada para estabilizar o backend.
    // O backend agora apenas registra a mensagem recebida e responde com sucesso.
    // Vamos reativar o processamento de leads assim que o servidor estiver estável.
    console.log('[WHATSAPP_WEBHOOK] Processamento de lead desativado temporariamente.');
    
    console.log('[WHATSAPP_WEBHOOK] Respondendo 200 OK para a API da Meta.');
    return NextResponse.json({ status: "success - recovery mode" }, { status: 200 });

  } catch (error) {
    console.error('[WHATSAPP_WEBHOOK] ERRO CRÍTICO no processamento do webhook:', error);
    // Mesmo em caso de erro, é importante responder 200 para a Meta
    return NextResponse.json({ message: "Erro interno no servidor, mas a notificação foi recebida." }, { status: 200 });
  }
}
