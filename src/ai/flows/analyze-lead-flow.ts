'use server';
/**
 * @fileOverview A Genkit flow to analyze a lead, providing a score and next action suggestion.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { initializeAdmin } from '@/lib/firebase/admin';
import type { LeadDocumentData, ChatMessage } from '@/types/crm';
import admin from 'firebase-admin';

// Input for the flow is just the lead's ID
const AnalyzeLeadInputSchema = z.string().describe("The ID of the lead to analyze.");
export type AnalyzeLeadInput = z.infer<typeof AnalyzeLeadInputSchema>;

// Define the structured output we want from the AI model
const AnalyzeLeadOutputSchema = z.object({
  leadScore: z.number().min(1).max(100).describe("A lead score from 1 to 100, where 100 is a very high-quality lead with high chance of closing."),
  scoreJustification: z.string().describe("A brief, one-sentence justification for the given score."),
  nextActionSuggestion: z.string().describe("A single, concise, and actionable next step for the salesperson. Example: 'Send the contract for signature.' or 'Follow up about the bill analysis.'"),
});
export type AnalyzeLeadOutput = z.infer<typeof AnalyzeLeadOutputSchema>;

// Exported wrapper function to be called from the UI
export async function analyzeLead(leadId: AnalyzeLeadInput): Promise<AnalyzeLeadOutput> {
  return await analyzeLeadFlow(leadId);
}

// Define the prompt for the AI model
const leadAnalysisPrompt = ai.definePrompt({
  name: 'leadAnalysisPrompt',
  input: { schema: z.object({ leadData: z.any(), transcript: z.string() }) },
  output: { schema: AnalyzeLeadOutputSchema },
  prompt: `You are a CRM assistant for an energy company called Sent Energia.
Your task is to analyze a sales lead and provide a score and a concrete next action for the salesperson.

LEAD DATA:
- Stage: {{leadData.stageId}}
- Consumption: {{leadData.kwh}} kWh
- Lead Source: {{leadData.leadSource}}
- Customer Type: {{leadData.customerType}}

CONVERSATION TRANSCRIPT:
---
{{transcript}}
---

ANALYSIS TASKS:
1.  **Lead Score (1-100):** Assign a score from 1 to 100 representing the lead's quality and likelihood to close.
    -   **High Score Factors:** High kWh consumption, responsive and positive chat, in a late-stage funnel (like 'proposta' or 'contrato'), referred from a good source ('Indicação').
    -   **Low Score Factors:** Low kWh, unresponsive, negative sentiment, stuck in an early stage for a long time.
2.  **Score Justification:** Provide a brief, one-sentence justification for your score.
3.  **Next Action Suggestion:** Suggest a single, clear, and actionable next step for the salesperson. It should be relevant to the lead's current stage and the conversation.

Provide your response in the requested JSON format.`,
});

// Define the main Genkit flow
const analyzeLeadFlow = ai.defineFlow(
  {
    name: 'analyzeLeadFlow',
    inputSchema: AnalyzeLeadInputSchema,
    outputSchema: AnalyzeLeadOutputSchema,
  },
  async (leadId) => {
    const adminDb = await initializeAdmin();
    
    // 1. Fetch Lead and Chat data
    const leadDocRef = adminDb.collection("crm_leads").doc(leadId);
    const chatDocRef = adminDb.collection("crm_lead_chats").doc(leadId);

    const [leadDoc, chatDoc] = await Promise.all([leadDocRef.get(), chatDocRef.get()]);

    if (!leadDoc.exists) {
      throw new Error("Lead not found.");
    }

    const leadData = leadDoc.data() as LeadDocumentData;
    const messages = (chatDoc.exists && chatDoc.data()?.messages) ? (chatDoc.data()?.messages as ChatMessage[]) : [];

    // Convert Firestore Timestamps to strings to ensure serializability before passing to the prompt.
    const serializableLeadData: { [key: string]: any } = {};
    for (const key in leadData) {
      const value = (leadData as any)[key];
      if (value instanceof admin.firestore.Timestamp) {
        serializableLeadData[key] = value.toDate().toISOString();
      } else {
        serializableLeadData[key] = value;
      }
    }

    // 2. Format data for the prompt
    const transcript = messages.length > 0
      ? messages.map(msg => `${msg.sender === 'user' ? 'Vendedor' : 'Cliente'}: ${msg.text}`).join('\n')
      : "No conversation history.";

    // 3. Call the AI model with serializable data
    const llmResponse = await leadAnalysisPrompt({ leadData: serializableLeadData, transcript });
    const analysisResult = llmResponse.output;

    if (!analysisResult) {
        throw new Error("AI analysis failed to produce a result.");
    }

    // 4. Save the analysis back to the lead document
    await leadDocRef.update({
      leadScore: analysisResult.leadScore,
      scoreJustification: analysisResult.scoreJustification,
      nextActionSuggestion: analysisResult.nextActionSuggestion,
      lastAnalyzedAt: admin.firestore.Timestamp.now(),
    });
    
    // 5. Return the result to the client
    return analysisResult;
  }
);
