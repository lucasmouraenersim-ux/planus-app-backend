import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// The GCLOUD_PROJECT environment variable is automatically set in App Hosting.
// Passing it explicitly to the Google AI plugin can help resolve authentication
// issues in some environments.
const projectId = process.env.GCLOUD_PROJECT;

// Initialize Genkit and the Google AI plugin
export const ai = genkit({
  plugins: [googleAI({ projectId })],
});
