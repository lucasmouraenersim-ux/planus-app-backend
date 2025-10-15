import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit and the Google AI plugin.
// In a Google Cloud environment like App Hosting, the plugin automatically
// discovers the project ID and authenticates using the environment's
// service account. Explicitly setting the project ID is not necessary.
export const ai = genkit({
  plugins: [googleAI()],
});
