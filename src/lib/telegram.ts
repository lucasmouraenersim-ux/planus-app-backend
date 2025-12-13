// src/lib/telegram.ts

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function sendTelegramNotification(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    console.warn("⚠️ Telegram não configurado no .env");
    return;
  }

  try {
    const url = `${TELEGRAM_API}${token}/sendMessage`;
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML' // Permite usar negrito e itálico
      })
    });
  } catch (error) {
    console.error("Erro ao enviar notificação Telegram:", error);
  }
}
