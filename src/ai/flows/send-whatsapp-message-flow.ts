
'use server';
/**
 * @fileOverview A flow to send a single WhatsApp message (template or text) via the Meta Graph API.
 *
 * - sendWhatsappMessage - Sends a message to a phone number.
 * - SendWhatsappMessageInput - The input type for the function.
 * - SendWhatsappMessageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SendWhatsappMessageInputSchema = z.object({
  to: z.string().describe("The recipient's phone number."),
  message: z.object({
    text: z.string().optional().describe("The text content for a plain text message."),
    template: z.object({
      name: z.string().describe("The name of the pre-approved WhatsApp message template."),
      bodyParams: z.array(z.string()).optional().describe("An array of strings to replace the variables {{1}}, {{2}}, etc., in the template's body."),
      headerImageUrl: z.string().url().optional().describe("A URL for an image to be used in the template's header."),
    }).optional().describe("The template to use for the message."),
  }).refine(m => m.text || m.template, {
    message: "Either a 'text' or a 'template' object must be provided in the message.",
  })
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
    // Robust phone number normalization
    let to = input.to.replace(/\D/g, ''); // 1. Remove non-digits
    
    // 2. Add country code if missing
    if (to.length === 10 || to.length === 11) {
        to = '55' + to;
    }

    // 3. Add the 9th digit for mobile numbers if missing
    if (to.startsWith('55') && to.length === 12) {
      const areaCode = to.substring(2, 4);
      const numberPart = to.substring(4);
      const correctedTo = `55${areaCode}9${numberPart}`;
      console.log(`[WHATSAPP_API_FIX] Corrected phone number from ${input.to} to ${correctedTo}`);
      to = correctedTo;
    }

    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    const accessToken = process.env.META_ACCESS_TOKEN || "EAA4IDY7gn5sBO8PMEkX5DSkb6jIctMZCFPykFxfhZAMZBULqMBdFZAiN5frhRRzVLVHgwzcE10QAmY1xuXZBZAERXskOqIGZB1k5VdAbKaE2GrLZA6RaBRs8CIqnDVW3p5ZAYY2vFTDPbq2B3IHsc2ZAVYE4Fq8c19iHxTJMotJypv63UOwLrtFaCFs5SF5JUUJYFfNJmmHbj5bYMn3bcbI0XwcC1THR4J1erLcoQHbi0sog0L";
    const apiVersion = 'v20.0'; 

    if (!phoneNumberId || !accessToken) {
      const errorMessage = "WhatsApp API não configurada. Verifique a variável META_PHONE_NUMBER_ID ou o token de acesso.";
      console.error(`[WHATSAPP_API] Error: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
    
    const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    
    let requestBody: any;

    if (input.message.template) {
      requestBody = {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: input.message.template.name,
          language: { "code": "pt_BR" },
        }
      };

      const components = [];

      // Add header component if an image URL is provided
      if (input.message.template.headerImageUrl) {
        components.push({
          type: 'header',
          parameters: [{
            type: 'image',
            image: { link: input.message.template.headerImageUrl }
          }]
        });
      }

      // Add body component if body parameters are provided
      if (input.message.template.bodyParams && input.message.template.bodyParams.length > 0) {
        components.push({
          type: 'body',
          parameters: input.message.template.bodyParams.map(param => ({ type: 'text', text: param })),
        });
      }
      
      // Attach components array to the request body if it's not empty
      if (components.length > 0) {
        requestBody.template.components = components;
      }

    } else if (input.message.text) {
      requestBody = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          preview_url: false, // Good practice for system messages
          body: input.message.text
        }
      };
    } else {
        return { success: false, error: "Invalid message payload. Must be text or template." };
    }

    try {
      console.log(`[WHATSAPP_API] Preparing to send message to: ${to}. API URL: ${apiUrl}`);
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
