
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
  // 1. Normalize phone number
  let to = input.to.replace(/\D/g, ''); // Remove all non-digits

  // 2. Handle country code and 9th digit for Brazilian numbers
  if (to.length === 11) { // Common format: DD + 9 digits (e.g., 65981390777)
    to = `55${to}`;
  } else if (to.length === 10) { // Old format: DD + 8 digits
    const ddd = to.substring(0, 2);
    const numberPart = to.substring(2);
    if (/^[6-9]/.test(numberPart)) { // It's a mobile number
      to = `55${ddd}9${numberPart}`;
      console.log(`[WHATSAPP_API_FIX] Corrected 10-digit mobile from ${input.to} to ${to}`);
    } else { // It's a landline
      to = `55${to}`;
    }
  } else if (to.startsWith('55')) {
    // If it already has country code, check for 9th digit if it looks like an old mobile number
    if (to.length === 12) { // 55 + DD + 8 digits
      const ddd = to.substring(2, 4);
      const numberPart = to.substring(4);
      if (/^[6-9]/.test(numberPart)) {
        to = `55${ddd}9${numberPart}`;
        console.log(`[WHATSAPP_API_FIX] Corrected 12-digit mobile from ${input.to} to ${to}`);
      }
    }
  } else if (to.length === 8 || to.length === 9) {
    // Should not happen if DDD is always provided, but as a fallback, assume it's missing.
    // This is less reliable. The ideal is to always have the DDD.
    console.warn(`[WHATSAPP_API_WARN] Phone number ${input.to} provided without DDD. Assuming a default or context-specific DDD may be necessary.`);
  }


  // Using hardcoded values as a temporary measure to unblock the user.
  // Best practice is to use environment variables/secrets.
  const phoneNumberId = "750855334768614";
  const accessToken = "EAA4IDY7gn5sBOwwZCgm3lF97sL7JQxoYkEdZClgKSXkwX02ZAx0eVZC1793rjv8bDIZCk9RMeyb7Q5b3ntiUau05B3lYy7ZC8mcSB1Q8vanVnT4zkbxLZAaknZAZB4WQrO27ERykV8AJQZCisRKmDee5oqzYzcjt3tkKxl8ZAuHjrVB5fcaIofdVdcw6eCl9TWmszbVdAG54gZDZD";
  const apiVersion = 'v20.0'; 

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
        preview_url: false, // Good practice for system messages
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
