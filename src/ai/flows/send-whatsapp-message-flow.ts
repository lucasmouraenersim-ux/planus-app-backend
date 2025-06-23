
'use server';
/**
 * @fileOverview A flow to send a single WhatsApp message via the Meta Graph API.
 *
 * - sendWhatsappMessage - Sends a message to a phone number.
 * - SendWhatsappMessageInput - The input type for the function.
 * - SendWhatsappMessageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SendWhatsappMessageInputSchema = z.object({
  to: z.string().describe("The recipient's phone number, including country code but no '+', e.g., '5511999998888'."),
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
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    const accessToken = process.env.META_PERMANENT_TOKEN;
    const apiVersion = 'v20.0'; // Updated to a current stable version

    if (!phoneNumberId || !accessToken) {
      const errorMessage = "WhatsApp API não configurada no servidor. Verifique as variáveis META_PHONE_NUMBER_ID e META_PERMANENT_TOKEN no arquivo .env.";
      console.error(`[WHATSAPP_API] Error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }

    const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    try {
      console.log(`[WHATSAPP_API] Sending message to: ${input.to} via Meta Graph API`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.to,
          type: "text",
          text: {
            body: input.body
          }
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // This block handles API errors returned by Meta (e.g., bad request, invalid token)
        const errorDetails = responseData?.error?.message || JSON.stringify(responseData);
        console.error(`[WHATSAPP_API] API Error: Status ${response.status}. Details: ${errorDetails}`);
        return {
          success: false,
          error: `Falha ao enviar mensagem. A API respondeu com: ${errorDetails}`,
        };
      }

      const messageId = responseData.messages?.[0]?.id || `api_resp_${Date.now()}`;
      console.log(`[WHATSAPP_API] Message sent successfully. Message ID: ${messageId}`);
      
      return {
        success: true,
        messageId: messageId,
      };

    } catch (error: any) {
      // This block handles critical network errors or other unexpected issues during the fetch itself.
      console.error("[WHATSAPP_API] Critical fetch/processing error:", error);
      return {
        success: false,
        error: `Erro de rede ou crítico ao tentar contatar a API do WhatsApp: ${error.message || 'Erro desconhecido.'}`,
      };
    }
  }
);
