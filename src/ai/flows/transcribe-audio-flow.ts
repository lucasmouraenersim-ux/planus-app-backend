'use server';
/**
 * @fileOverview A Genkit flow to transcribe audio from a URL.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TranscribeAudioInputSchema = z.string().url().describe("The public URL of the audio file to transcribe.");
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  transcription: z.string().describe("The transcribed text from the audio."),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;


const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async (audioUrl) => {
    const llmResponse = await ai.generate({
      // Use a model capable of speech transcription. Gemini 1.5 Flash is a good choice.
      model: 'googleai/gemini-1.5-flash-latest', 
      prompt: [
        { text: 'Transcribe the following audio file. Return only the transcribed text.' },
        { media: { url: audioUrl } }
      ]
    });

    const transcription = llmResponse.text;
    
    return { transcription };
  }
);

// Exported wrapper function
export async function transcribeAudio(audioUrl: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  const result = await transcribeAudioFlow(audioUrl);
  return result || { transcription: "" };
}
