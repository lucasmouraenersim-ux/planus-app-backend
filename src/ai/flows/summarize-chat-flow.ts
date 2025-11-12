
'use server';
/**
 * @fileOverview A Genkit flow to summarize a chat conversation for a CRM lead.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { initializeAdmin } from '@/lib/firebase/admin';
import type { ChatMessage } from '@/types/crm';
import type { Timestamp } from 'firebase-admin/firestore';

const SummarizeChatInputSchema = z.string().describe("The ID of the lead's chat to summarize.");
export type SummarizeChatInput = z.infer<typeof SummarizeChatInputSchema>;

const SummarizeChatOutputSchema = z.object({
    summary: z.string().describe("The generated summary of the conversation.")
});
export type SummarizeChatOutput = z.infer<typeof SummarizeChatOutputSchema>;

// Wrapper function to be called from the UI
export async function summarizeChat(leadId: SummarizeChatInput): Promise<SummarizeChatOutput> {
    return await summarizeChatFlow(leadId);
}

const summarizeChatFlow = ai.defineFlow(
    {
        name: 'summarizeChatFlow',
        inputSchema: SummarizeChatInputSchema,
        outputSchema: SummarizeChatOutputSchema
    },
    async (leadId) => {
        const { db: adminDb } = await initializeAdmin();
        const chatDocRef = adminDb.collection("crm_lead_chats").doc(leadId);
        const chatDoc = await chatDocRef.get();

        if (!chatDoc.exists) {
            return { summary: "Nenhuma conversa encontrada para este lead." };
        }

        const messages = (chatDoc.data()?.messages || []) as ChatMessage[];
        if (messages.length === 0) {
            return { summary: "A conversa está vazia." };
        }

        const transcript = messages
            .map(msg => `${msg.sender === 'user' ? 'Vendedor' : 'Cliente'}: ${msg.text}`)
            .join('\n');
        
        const llmResponse = await ai.generate({
            model: 'googleai/gemini-1.5-flash-latest',
            prompt: `Você é um assistente de vendas e especialista em CRM. Sua tarefa é resumir a conversa a seguir entre um vendedor e um cliente. O resumo deve ser conciso, em português, e focado nos pontos principais, como interesses do cliente, objeções e próximos passos combinados.

            Aqui está a conversa:
            ---
            ${transcript}
            ---
            
            Forneça um resumo em bullet points.`
        });

        const summary = llmResponse.text;
        return { summary };
    }
);

    
