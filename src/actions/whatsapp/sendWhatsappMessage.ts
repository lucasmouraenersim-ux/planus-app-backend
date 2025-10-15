
'use server';
/**
 * @fileOverview A server action to send a single WhatsApp message (template, text, image, audio, or document) via the Meta Graph API.
 *
 * - sendWhatsappMessage - Sends a message to a phone number.
 * - SendWhatsappMessageInput - The input type for the function.
 * - SendWhatsappMessageOutput - The return type for the function.
 */

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
    image: z.object({
      link: z.string().url(),
      caption: z.string().optional(),
    }).optional(),
    audio: z.object({
      link: z.string().url(),
    }).optional(),
    document: z.object({
      link: z.string().url(),
      filename: z.string().optional(),
    }).optional(),
  }).refine(m => m.text || m.template || m.image || m.audio || m.document, {
    message: "Either a 'text', 'template', 'image', 'audio', or 'document' object must be provided in the message.",
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
  // 1. Normalize phone number by removing all non-digit characters
  let to = input.to.replace(/\D/g, '');

  // 2. Add Brazilian country code if it's missing
  if (to.length <= 11 && !to.startsWith('55')) {
    to = `55${to}`;
  }

  // 3. Handle the 9th digit for Brazilian mobile numbers
  if (to.length === 12 && to.startsWith('55')) { // e.g., 55 + DD (2) + 8 digits = 12
      const ddd = to.substring(2, 4);
      const numberPart = to.substring(4);
      if (ddd >= '11' && ddd <= '99') { // Basic DDD validation
          to = `55${ddd}9${numberPart}`;
          console.log(`[WHATSAPP_API_FIX] Added 9th digit. Corrected 12-digit mobile from ${input.to} to ${to}`);
      }
  }

  // Use environment variables for credentials
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = 'v20.0'; 

  if (!phoneNumberId || !accessToken) {
    const errorMessage = "Credenciais da API do WhatsApp não configuradas no ambiente.";
    console.error(`[WHATSAPP_API] ERROR: ${errorMessage}`);
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
    if (input.message.template.headerImageUrl) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: input.message.template.headerImageUrl } }]
      });
    }
    if (input.message.template.bodyParams && input.message.template.bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: input.message.template.bodyParams.map(param => ({ type: 'text', text: param })),
      });
    }
    if (components.length > 0) {
      requestBody.template.components = components;
    }
  } else if (input.message.image) {
    requestBody = {
      messaging_product: "whatsapp",
      to: to,
      type: "image",
      image: { 
        link: input.message.image.link,
        ...(input.message.image.caption && { caption: input.message.image.caption })
      }
    };
  } else if (input.message.audio) {
    requestBody = {
      messaging_product: "whatsapp",
      to: to,
      type: "audio",
      audio: { link: input.message.audio.link }
    };
  } else if (input.message.document) {
    requestBody = {
      messaging_product: "whatsapp",
      to: to,
      type: "document",
      document: { 
        link: input.message.document.link,
        ...(input.message.document.filename && { filename: input.message.document.filename })
      }
    };
  } else if (input.message.text) {
    requestBody = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: {
        preview_url: false,
        body: input.message.text
      }
    };
  } else {
      return { success: false, error: "Invalid message payload. Must be text, template, image, audio, or document." };
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
