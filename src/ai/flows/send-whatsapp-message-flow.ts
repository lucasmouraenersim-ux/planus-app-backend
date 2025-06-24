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
    let to = input.to.replace(/\D/g, ''); // Normalize phone number

    // Automatically correct Brazilian numbers missing the 9th digit.
    // Valid format is 55 (country) + XX (area) + 9 (digit) + XXXXXXXX (number) = 13 digits.
    // Incorrect but common format is 55 + XX + XXXXXXXX = 12 digits.
    if (to.startsWith('55') && to.length === 12) {
      const areaCode = to.substring(2, 4);
      const numberPart = to.substring(4);
      const correctedTo = `55${areaCode}9${numberPart}`;
      console.log(`[WHATSAPP_API_FIX] Corrected phone number from ${to} to ${correctedTo}`);
      to = correctedTo;
    }

    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    // !! DEBUGGING STEP: Token hardcoded to bypass environment variable caching issue on Firebase.
    const accessToken = "EAA4IDY7gn5sBO8PMEkX5DSkb6jIctMZCFPykFxfhZAMZBULqMBdFZAiN5frhRRzVLVHgwzcE10QAmY1xuXZBZAERXskOqIGZB1k5VdAbKaE2GrLZA6RaBRs8CIqnDVW3p5ZAYY2vFTDPbq2B3IHsc2ZAVYE4Fq8c19iHxTJMotJypv63UOwLrtFaCFs5SF5JUUJYFfNJmmHbj5bYMn3bcbI0XwcC1THR4J1erLcoQHbi0sog0L";
    const apiVersion = 'v20.0'; 

    if (!phoneNumberId || !accessToken) {
      const errorMessage = "WhatsApp API não configurada. Verifique a variável META_PHONE_NUMBER_ID ou o token hardcoded.";
      console.error(`[WHATSAPP_API] Error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    // Log a masked version of the token to confirm which one is being used
    console.log(`[WHATSAPP_API] Using token starting with: ${accessToken.substring(0, 4)}... and ending with: ...${accessToken.substring(accessToken.length - 4)}`);
    console.log('[WHATSAPP_API] Forcing rebuild and re-read of environment variables.');

    const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    
    // Using the fully encoded URL from the working CURL command to prevent re-encoding issues.
    const imageUrl = "https://raw.githubusercontent.com/LucasMouraChaser/backgrounds-sent/fc30ce6fef5a3ebac0439eeab4a5704c64f8ee7c/Imagem%20do%20WhatsApp%20de%202025-06-17%20%C3%A0(s)%2010.04.50_a5712825.jpg";

    const requestBody = {
      messaging_product: "whatsapp",
      to: to, // Use the potentially corrected phone number
      type: "template",
      template: {
        name: "novocontato",
        language: { "code": "pt_BR" },
        components: [
          {
            "type": "header",
            "parameters": [
              {
                "type": "image",
                "image": {
                  "link": imageUrl
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

      if (!response.ok || !responseData.messages?.[0]?.id) {
        const errorDetails = responseData?.error?.message || JSON.stringify(responseData);
        console.error(`[WHATSAPP_API] API Error: Status ${response.status}. Details: ${errorDetails}`);
        return {
          success: false,
          error: `Falha ao enviar mensagem. A API respondeu com: ${errorDetails}`,
        };
      }

      const messageId = responseData.messages[0].id;
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
