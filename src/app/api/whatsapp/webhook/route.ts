
import { NextRequest, NextResponse } from 'next/server';
import { ingestWhatsappMessage } from '@/ai/flows/ingest-whatsapp-message-flow'; // Import the new flow

const VERIFY_TOKEN = "testeapi";

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

export async function POST(request: NextRequest) {
    console.log('--- [WHATSAPP_WEBHOOK] Nova requisição POST recebida ---');
    try {
        const body = await request.json();
        console.log('[WHATSAPP_WEBHOOK] Payload completo recebido:', JSON.stringify(body, null, 2));

        // Asynchronously call the Genkit flow to handle the logic.
        // We do NOT await the result here because the webhook needs to return 200 OK immediately.
        // The flow will run in the background with server permissions.
        ingestWhatsappMessage(body).catch(error => {
            // Log any critical errors from the flow invocation itself
            console.error('[WHATSAPP_WEBHOOK] Erro CRÍTICO ao invocar o flow ingestWhatsappMessage:', error);
        });

        // Immediately acknowledge receipt to Meta API.
        return NextResponse.json({ status: "success" }, { status: 200 });

    } catch (error) {
        console.error('[WHATSAPP_WEBHOOK] ERRO CRÍTICO no processamento do webhook (parsing do body, etc.):', error);
        // Still return 200 OK to prevent webhook suspension
        return NextResponse.json({ message: "Erro interno no servidor, mas a notificação foi recebida." }, { status: 200 });
    }
}
