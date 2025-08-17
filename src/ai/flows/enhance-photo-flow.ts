
'use server';
/**
 * @fileOverview A Genkit flow to enhance a user-provided photo using an AI model.
 *
 * - enhancePhoto: A function that handles the photo enhancement process.
 * - EnhancePhotoInput: The input type for the enhancePhoto function.
 * - EnhancePhotoOutput: The return type for the enhancePhoto function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the input schema for the flow
const EnhancePhotoInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to be enhanced, provided as a data URI. It must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type EnhancePhotoInput = z.infer<typeof EnhancePhotoInputSchema>;

// Define the output schema for the flow
const EnhancePhotoOutputSchema = z.object({
  imageUrl: z.string().url().describe('The URL of the enhanced image.'),
});
export type EnhancePhotoOutput = z.infer<typeof EnhancePhotoOutputSchema>;

/**
 * Main exported function to be called from the frontend.
 * It takes the input, calls the Genkit flow, and returns the output.
 * @param input The input object containing the photo data URI.
 * @returns A promise that resolves to the output object with the enhanced image URL.
 */
export async function enhancePhoto(input: EnhancePhotoInput): Promise<EnhancePhotoOutput> {
  return enhancePhotoFlow(input);
}


// Define the main Genkit flow for enhancing the photo
const enhancePhotoFlow = ai.defineFlow(
  {
    name: 'enhancePhotoFlow',
    inputSchema: EnhancePhotoInputSchema,
    outputSchema: EnhancePhotoOutputSchema,
  },
  async (input) => {
    // Call the Gemini model for image generation
    const { media } = await ai.generate({
      // Use a model capable of image generation.
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      
      // Provide a prompt that includes the original image and instructions for enhancement
      prompt: [
        { media: { url: input.photoDataUri } },
        { text: 'Você é um editor de fotos especialista. Sua tarefa é aprimorar a imagem fornecida com a mais alta qualidade possível, como se tivesse sido redimensionada para uma resolução 8K. A imagem final deve ser fotorrealista, ultra nítida e completamente livre de ruído digital ou artefatos de compressão. Preste muita atenção em realçar todos os detalhes e preservar as texturas originais. É crucial que você NÃO altere a composição ou o assunto original da imagem. Seu objetivo é elevar a qualidade técnica e estética a um padrão de fotografia profissional, mantendo sua originalidade.' },
      ],

      // Configuration to specify that we expect an IMAGE in the response.
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    // Check if the model returned an image
    if (!media || !media.url) {
      throw new Error('A IA não conseguiu gerar uma imagem aprimorada.');
    }

    // Return the URL of the generated image
    return {
      imageUrl: media.url,
    };
  }
);
