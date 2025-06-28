'use server';
/**
 * @fileOverview A server action for bulk WhatsApp message sending using the Meta API.
 *
 * - sendBulkWhatsappMessages - A function that sends bulk messages.
 * - SendBulkWhatsappMessagesInput - The input type for the function.
 * - SendBulkWhatsappMessagesOutput - The return type for the function.
 */

import { z } from 'zod';
import { sendWhatsappMessage } from './sendWhatsappMessage';

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
  try {
    const { leads, templateName, configuration } = input;
    const { sendInterval, numberOfSimultaneousWhatsapps } = configuration;

    // Mapping template names to their respective header image URLs
    const TEMPLATE_IMAGE_URLS: { [key: string]: string } = {
      novocontato: "https://raw.githubusercontent.com/LucasMouraChaser/backgrounds-sent/fc30ce6fef5a3ebac0439eeab4a5704c64f8ee7c/Imagem%20do%20WhatsApp%20de%202025-06-17%20%C3%A0(s)%2010.04.50_a5712825.jpg",
      leadsquentes: "https://raw.githubusercontent.com/LucasMouraChaser/apisent/406ebbca68d4f86df445d7712fcd5f7131f251/fundoleadsquentes.png"
    };

    const headerImageUrl = TEMPLATE_IMAGE_URLS[templateName];

    if (!headerImageUrl) {
        return {
          success: false,
          message: `Ocorreu um erro: Template de mensagem '${templateName}' não tem uma imagem de cabeçalho configurada.`,
          sentCount: 0,
        };
    }

    let sentCount = 0;
    const totalLeads = leads.length;

    for (let i = 0; i < totalLeads; i += numberOfSimultaneousWhatsapps) {
      const chunk = leads.slice(i, i + numberOfSimultaneousWhatsapps);
      console.log(`[WHATSAPP_BULK_SEND] Processing chunk starting at index ${i}. Chunk size: ${chunk.length}`);

      const sendPromises = chunk.map(lead => {
        // Conditionally add body parameters based on the template name.
        const bodyParams = templateName === 'leadsquentes' ? [lead.name] : undefined;
        
        return sendWhatsappMessage({ 
            to: lead.phone,
            message: {
                template: {
                    name: templateName,
                    headerImageUrl: headerImageUrl,
                    bodyParams: bodyParams
                }
            }
        }).then(result => {
            if (result.success) {
                sentCount++;
                console.log(`[WHATSAPP_BULK_SEND] Success sending to ${lead.phone}. Message ID: ${result.messageId}`);
            } else {
                console.error(`[WHATSAPP_BULK_SEND] Failed to send to ${lead.phone}. Reason:`, result.error);
            }
        }).catch(e => {
          console.error(`[WHATSAPP_BULK_SEND] Critical error sending to ${lead.phone}. Reason:`, e);
        })
      });

      await Promise.all(sendPromises);

      // Apply delay between chunks, if configured.
      if (i + numberOfSimultaneousWhatsapps < totalLeads && sendInterval > 0) {
        console.log(`[WHATSAPP_BULK_SEND] Waiting for ${sendInterval} seconds before next chunk.`);
        await new Promise(resolve => setTimeout(resolve, sendInterval * 1000));
      }
    }

    return {
      success: true,
      message: `Disparo concluído. ${sentCount} de ${totalLeads} mensagens foram processadas. Verifique os logs para detalhes.`,
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
