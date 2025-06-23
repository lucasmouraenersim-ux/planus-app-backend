
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
    try {
      const { leads, templateName, configuration } = input;
      const { sendInterval } = configuration;

      const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
      const accessToken = process.env.META_PERMANENT_TOKEN;
      const apiVersion = 'v20.0';

      if (!phoneNumberId || !accessToken) {
        const errorMessage = "Credenciais da API do WhatsApp não configuradas no servidor. Verifique as variáveis de ambiente no arquivo apphosting.yaml.";
        console.error(`[WHATSAPP_BULK_SEND] Error: ${errorMessage}`);
        return {
          success: false,
          message: errorMessage,
          sentCount: 0,
        };
      }

      const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
      let sentCount = 0;
      const totalLeads = leads.length;

      for (let i = 0; i < totalLeads; i++) {
        const lead = leads[i];
        
        console.log(`[WHATSAPP_BULK_SEND] Processing lead ${i + 1}/${totalLeads}: ${lead.name} (${lead.phone})`);

        // Standard template call with one body parameter
        const requestBody = {
          messaging_product: "whatsapp",
          to: lead.phone,
          type: "template",
          template: {
            name: templateName,
            language: { "code": "pt_BR" },
            components: [
                {
                    "type": "body",
                    "parameters": [
                        {
                            "type": "text",
                            "text": lead.name
                        }
                    ]
                }
            ]
          },
        };
        
        console.log(`[WHATSAPP_BULK_SEND] Sending template '${templateName}' to ${lead.phone}. Body:`, JSON.stringify(requestBody));
        
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
            const errorData = await response.json();
            // Display the exact error from Meta API for better debugging
            const errorMessage = errorData?.error?.message || JSON.stringify(errorData);
            console.error(`[WHATSAPP_BULK_SEND] Failed to send to ${lead.phone}. Status: ${response.status}. Response Body:`, errorMessage);
            
            // Stop the entire flow on the first error and report it clearly.
            return {
              success: false,
              message: `Erro da API do WhatsApp: ${errorMessage}`,
              sentCount: sentCount,
            };
        }

        // Wait between messages if an interval is set
        if (i < totalLeads - 1 && sendInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, sendInterval * 1000));
        }
      }

      return {
        success: true,
        message: `Disparo concluído. ${sentCount} mensagens enviadas com sucesso.`,
        sentCount: sentCount,
      };

    } catch (e: unknown) {
        console.error('[WHATSAPP_BULK_SEND] Critical flow error:', e);
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        return {
            success: false,
            message: `Ocorreu um erro crítico no servidor: ${errorMessage}. Verifique os logs do Firebase.`,
            sentCount: 0
        };
    }
  }
);
