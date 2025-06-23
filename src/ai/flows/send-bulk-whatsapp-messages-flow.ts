
'use server';
/**
 * @fileOverview A bulk WhatsApp message sending flow using the Meta API.
 *
 * - sendBulkWhatsappMessages - A function that sends bulk messages.
 * - SendBulkWhatsappMessagesInput - The input type for the function.
 * - SendBulkWhatsappMessagesOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const OutboundLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  consumption: z.number(),
  company: z.string().optional(),
});
export type OutboundLead = z.infer<typeof OutboundLeadSchema>;

const SendingConfigurationSchema = z.object({
  sendPerChip: z.number().int().positive(),
  sendInterval: z.number().int().positive(),
  randomDelay: z.number().int().nonnegative(),
  restAfterRound: z.string(),
  numberOfSimultaneousWhatsapps: z.number().int().positive(),
});
export type SendingConfiguration = z.infer<typeof SendingConfigurationSchema>;

const SendBulkWhatsappMessagesInputSchema = z.object({
  leads: z.array(OutboundLeadSchema),
  templateName: z.string().describe("The name of the pre-approved WhatsApp message template."),
  configuration: SendingConfigurationSchema,
});
export type SendBulkWhatsappMessagesInput = z.infer<typeof SendBulkWhatsappMessagesInputSchema>;

const SendBulkWhatsappMessagesOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sentCount: z.number(),
});
export type SendBulkWhatsappMessagesOutput = z.infer<typeof SendBulkWhatsappMessagesOutputSchema>;


export async function sendBulkWhatsappMessages(input: SendBulkWhatsappMessagesInput): Promise<SendBulkWhatsappMessagesOutput> {
  return sendBulkWhatsappMessagesFlow(input);
}


const sendBulkWhatsappMessagesFlow = ai.defineFlow(
  {
    name: 'sendBulkWhatsappMessagesFlow',
    inputSchema: SendBulkWhatsappMessagesInputSchema,
    outputSchema: SendBulkWhatsappMessagesOutputSchema,
  },
  async (input) => {
    try { // Add a top-level try-catch to prevent the server from crashing
      const { leads, templateName, configuration } = input;
      const { sendInterval } = configuration;

      const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
      const accessToken = process.env.META_PERMANENT_TOKEN;
      const apiVersion = 'v20.0';

      if (!phoneNumberId || !accessToken) {
        const errorMessage = "WhatsApp API não configurada no servidor. Verifique as variáveis de ambiente no painel do Firebase App Hosting.";
        console.error(`[WHATSAPP_BULK_SEND] Error: ${errorMessage}`);
        return {
          success: false,
          message: errorMessage,
          sentCount: 0,
        };
      }

      const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
      let sentCount = 0;
      let failedCount = 0;
      let firstErrorDetails = '';

      for (const lead of leads) {
        const requestBody = {
          messaging_product: "whatsapp",
          to: lead.phone,
          type: "template",
          template: {
            name: templateName,
            language: { "code": "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: lead.name,
                  },
                ],
              },
            ],
          },
        };

        try {
          console.log(`[WHATSAPP_BULK_SEND] Sending template '${templateName}' to ${lead.phone}.`);
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(requestBody),
          });
          
          if (response.ok) {
            sentCount++;
            const responseData = await response.json();
            console.log(`[WHATSAPP_BULK_SEND] Success sending to ${lead.phone}. Response:`, responseData);
          } else {
            failedCount++;
            const errorText = await response.text();
            console.error(`[WHATSAPP_BULK_SEND] Failed to send to ${lead.phone}. Status: ${response.status}. Response Body:`, errorText);
            if (!firstErrorDetails) {
              firstErrorDetails = `Falha no envio para ${lead.phone} (Status: ${response.status}). Resposta: ${errorText}`;
            }
          }
        } catch (error: any) {
          failedCount++;
          console.error(`[WHATSAPP_BULK_SEND] Critical fetch/processing error for ${lead.phone}:`, error.message, error.stack);
           if (!firstErrorDetails) {
              firstErrorDetails = `Erro crítico ao contatar a API para o número ${lead.phone}: ${error.message}`;
            }
        }

        if (leads.indexOf(lead) < leads.length - 1 && sendInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, sendInterval * 1000));
        }
      }

      if (failedCount > 0) {
        return {
          success: false,
          message: `Disparo concluído com ${failedCount} falha(s). ${sentCount} mensagens enviadas. Primeiro erro: ${firstErrorDetails}`,
          sentCount: sentCount,
        };
      }

      return {
        success: true,
        message: `Disparo concluído. ${sentCount} mensagens enviadas com sucesso.`,
        sentCount: sentCount,
      };
    } catch (e: any) {
        console.error('[WHATSAPP_BULK_SEND] Critical flow error:', e);
        return {
            success: false,
            message: `Ocorreu um erro crítico no servidor: ${e.message}. Verifique os logs do Firebase.`,
            sentCount: 0
        };
    }
  }
);
