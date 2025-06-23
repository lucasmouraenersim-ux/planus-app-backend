'use server';
/**
 * @fileOverview A flow to simulate sending a single WhatsApp message.
 *
 * - sendWhatsappMessage - Simulates sending a message to a phone number.
 * - SendWhatsappMessageInput - The input type for the function.
 * - SendWhatsappMessageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SendWhatsappMessageInputSchema = z.object({
  to: z.string().describe("The recipient's phone number in E.164 format."),
  body: z.string().describe("The text content of the message."),
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
    // This is a simulation. We are not actually sending messages.
    // In a real implementation, you would use the WhatsApp Business API here.
    
    console.log(`[SIMULATION] Sending WhatsApp message to: ${input.to}`);
    console.log(`[SIMULATION] Message body: "${input.body}"`);

    // Simulate an API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const isSuccess = Math.random() > 0.1; // Simulate a 90% success rate

    if (isSuccess) {
      const simulatedMessageId = `sim_msg_${Date.now()}`;
      console.log(`[SIMULATION] Message sent successfully. Message ID: ${simulatedMessageId}`);
      return {
        success: true,
        messageId: simulatedMessageId,
      };
    } else {
      const errorMessage = "Failed to send message due to a simulated API error.";
      console.error(`[SIMULATION] ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
);
