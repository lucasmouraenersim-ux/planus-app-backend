import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit and the Google AI plugin
export const ai = genkit({
  plugins: [googleAI()],
});
