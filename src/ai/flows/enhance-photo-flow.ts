
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

const EnhancementTypeSchema = z.enum(['enhance', 'night', 'professional', 'canon_r5']);

// Define the input schema for the flow
const EnhancePhotoInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to be enhanced, provided as a data URI. It must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  enhancementType: EnhancementTypeSchema.optional().default('enhance'),
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
 * @param input The input object containing the photo data URI and enhancement type.
 * @returns A promise that resolves to the output object with the enhanced image URL.
 */
export async function enhancePhoto(input: EnhancePhotoInput): Promise<EnhancePhotoOutput> {
  return enhancePhotoFlow(input);
}

const getPromptForEnhancement = (type: z.infer<typeof EnhancementTypeSchema>) => {
  switch (type) {
    case 'canon_r5':
      return 'Sua tarefa é remasterizar a imagem fornecida. Use a mesma imagem, mas aprimore sua qualidade para um nível hiper-realista, como se fosse uma foto de alta resolução tirada por uma câmera Canon R5. Melhore drasticamente a nitidez, os detalhes e as cores, mas é absolutamente crucial que você não altere, adicione ou remova nenhum elemento do conteúdo original. O resultado deve ser fotorrealista e livre de ruídos.';
    case 'night':
      return 'Ilumine esta foto noturna, revelando detalhes nas sombras, mas mantendo a atmosfera da noite. Reduza o ruído e melhore a clareza geral, sem alterar o conteúdo original da imagem.';
    case 'professional':
      return 'Faça uma edição profissional nesta imagem. Ajuste o balanço de cores, contraste e exposição para um resultado profissional e atraente. Preserve o conteúdo original.';
    case 'enhance':
    default:
      return 'Sua tarefa é remasterizar a imagem fornecida. Use a mesma imagem, mas aprimore sua qualidade para um nível hiper-realista, como se fosse uma foto de alta resolução. Melhore a nitidez, os detalhes e as cores, mas é absolutamente crucial que você não altere, adicione ou remova nenhum elemento do conteúdo original.';
  }
};


// Define the main Genkit flow for enhancing the photo
const enhancePhotoFlow = ai.defineFlow(
  {
    name: 'enhancePhotoFlow',
    inputSchema: EnhancePhotoInputSchema,
    outputSchema: EnhancePhotoOutputSchema,
  },
  async (input) => {
    
    const promptText = getPromptForEnhancement(input.enhancementType);

    // Call the Gemini model for image generation
    const { media } = await ai.generate({
      // Use a model capable of image generation.
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      
      // Provide a prompt that includes the original image and instructions for enhancement
      prompt: [
        { media: { url: input.photoDataUri } },
        { text: promptText },
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
