
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
  body: z.string().describe("The text content of the message. Note: This is saved to history. The 'novocontato' template is assumed to be static."),
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
    const apiVersion = 'v20.0'; 

    if (!phoneNumberId || !accessToken) {
      const errorMessage = "WhatsApp API não configurada no servidor. Verifique as variáveis META_PHONE_NUMBER_ID e META_PERMANENT_TOKEN no arquivo apphosting.yaml.";
      console.error(`[WHATSAPP_API] Error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }

    const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    
    // Template 'novocontato' with a VIDEO in the header.
    const requestBody = {
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: "novocontato",
        language: { "code": "pt_BR" },
        components: [
          {
            "type": "header",
            "parameters": [
              {
                "type": "video",
                "video": {
                  // Using a generic placeholder video URL
                  "link": "https://videos.pexels.com/video-files/4434242/4434242-sd_640_360_30fps.mp4"
                }
              }
            ]
          }
        ]
      }
    };

    try {
      console.log(`[WHATSAPP_API] Preparing to send template message to URL: ${apiUrl}`);
      console.log(`[WHATSAPP_API] Request Body: ${JSON.stringify(requestBody)}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();
      console.log(`[WHATSAPP_API] Response Status: ${response.status}`);
      console.log(`[WHATSAPP_API] Response Data: ${JSON.stringify(responseData)}`);

      if (!response.ok) {
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
      console.error("[WHATSAPP_API] Critical fetch/processing error:", error);
      return {
        success: false,
        error: `Erro de rede ou crítico ao tentar contatar a API do WhatsApp: ${error.message || 'Erro desconhecido.'}`,
      };
    }
  }
);
