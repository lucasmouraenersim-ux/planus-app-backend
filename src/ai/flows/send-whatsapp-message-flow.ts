
'use server';
/**
 * @fileOverview A flow to send a single WhatsApp message via a real API.
 *
 * - sendWhatsappMessage - Sends a message to a phone number.
 * - SendWhatsappMessageInput - The input type for the function.
 * - SendWhatsappMessageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SendWhatsappMessageInputSchema = z.object({
  to: z.string().describe("The recipient's phone number in E.164 format."),
  body: z.string().describe("The text content of the message."),
});
export type SendWhatsappMessageInput = z.infer<typeof SendWhatsappMessageInputSchema>;

const SendWhatsappMessageOutputSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  error: z.string().optional(),
});
export type SendWhatsappMessageOutput = z.infer<typeof SendWhatsappMessageOutputSchema>;

export async function sendWhatsappMessage(input: SendWhatsappMessageInput): Promise<SendWhatsappMessageOutput> {
  return sendWhatsappMessageFlow(input);
}

const sendWhatsappMessageFlow = ai.defineFlow(
  {
    name: 'sendWhatsappMessageFlow',
    inputSchema: SendWhatsappMessageInputSchema,
    outputSchema: SendWhatsappMessageOutputSchema,
  },
  async (input) => {
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;

    if (!apiUrl || !apiKey) {
      console.error("[WHATSAPP_API] Error: WHATSAPP_API_URL or WHATSAPP_API_KEY is not defined in .env file.");
      return {
        success: false,
        error: "API de WhatsApp não configurada no servidor.",
      };
    }

    try {
      console.log(`[WHATSAPP_API] Sending message to: ${input.to} via ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`, // Assumindo autenticação Bearer Token, ajuste se necessário.
        },
        body: JSON.stringify({
          // Ajuste este corpo de requisição para corresponder ao que sua API espera.
          // Exemplo comum:
          to: input.to,
          message: input.body,
        }),
      });

      if (!response.ok) {
        // Tenta ler a resposta de erro da sua API
        const errorBody = await response.text();
        console.error(`[WHATSAPP_API] API Error: Status ${response.status}. Body: ${errorBody}`);
        return {
          success: false,
          error: `Falha ao enviar mensagem. A API respondeu com status ${response.status}.`,
        };
      }

      const responseData = await response.json();
      const messageId = responseData.messageId || `api_resp_${Date.now()}`; // Pegue o ID da resposta da sua API

      console.log(`[WHATSAPP_API] Message sent successfully. API Response:`, responseData);
      return {
        success: true,
        messageId: messageId,
      };

    } catch (error) {
      console.error("[WHATSAPP_API] Critical fetch error:", error);
      return {
        success: false,
        error: "Erro de rede ou crítico ao tentar contatar a API de WhatsApp.",
      };
    }
  }
);
