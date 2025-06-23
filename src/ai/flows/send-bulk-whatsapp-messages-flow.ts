
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
    const { leads, templateName, configuration } = input;
    const { sendInterval } = configuration;

    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    const accessToken = process.env.META_PERMANENT_TOKEN;
    const apiVersion = 'v20.0';

    if (!phoneNumberId || !accessToken) {
      const errorMessage = "WhatsApp API não configurada no servidor. Verifique as variáveis de ambiente.";
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

    for (const lead of leads) {
      // Assuming the template requires one variable in the body, which is the lead's name.
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
        console.log(`[WHATSAPP_BULK_SEND] Sending template '${templateName}' to ${lead.phone}. URL: ${apiUrl}`);
        console.log(`[WHATSAPP_BULK_SEND] Body: ${JSON.stringify(requestBody)}`);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(requestBody),
        });
        
        console.log(`[WHATSAPP_BULK_SEND] Response Status for ${lead.phone}: ${response.status}`);

        if (response.ok) {
          sentCount++;
          const responseData = await response.json();
          console.log(`[WHATSAPP_BULK_SEND] Success sending to ${lead.phone}. Response:`, responseData);
        } else {
          failedCount++;
          const errorText = await response.text();
          console.error(`[WHATSAPP_BULK_SEND] Failed to send to ${lead.phone}. Status: ${response.status}. Response Body:`, errorText);
        }
      } catch (error: any) {
        failedCount++;
        console.error(`[WHATSAPP_BULK_SEND] Critical fetch/processing error for ${lead.phone}:`, error.message, error.stack);
      }

      // Wait for the specified interval before sending the next message
      if (leads.length > 1 && sendInterval > 0) {
        await new Promise(resolve => setTimeout(resolve, sendInterval * 1000));
      }
    }

    return {
      success: failedCount === 0,
      message: `Disparo concluído. ${sentCount} mensagens enviadas com sucesso, ${failedCount} falharam.`,
      sentCount: sentCount,
    };
  }
);
