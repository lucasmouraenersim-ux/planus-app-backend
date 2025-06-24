
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
import { sendWhatsappMessage } from './send-whatsapp-message-flow';

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

      let sentCount = 0;
      const totalLeads = leads.length;

      for (let i = 0; i < totalLeads; i++) {
        const lead = leads[i];
        
        console.log(`[WHATSAPP_BULK_SEND] Processing lead ${i + 1}/${totalLeads}: ${lead.name} (${lead.phone})`);

        // Call the single-send flow with a template message payload
        const result = await sendWhatsappMessage({ 
            to: lead.phone,
            message: {
                template: {
                    name: templateName,
                    bodyParams: [lead.name] // Pass the lead's name as the first parameter {{1}}
                }
            }
        });

        if (result.success) {
            sentCount++;
            console.log(`[WHATSAPP_BULK_SEND] Success sending to ${lead.phone}. Message ID: ${result.messageId}`);
        } else {
            console.error(`[WHATSAPP_BULK_SEND] Failed to send to ${lead.phone}. Reason:`, result.error);
            // Do not stop the whole process for a single error. Log it and continue.
        }

        // Apply delay between sends, if configured.
        if (i < totalLeads - 1 && sendInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, sendInterval * 1000));
        }
      }

      return {
        success: true,
        message: `Disparo concluído. ${sentCount} de ${totalLeads} mensagens foram aceitas para envio.`,
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
