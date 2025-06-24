// Flows will be imported for their side effects in this file.
// These flows use the Admin SDK and are defined with a clean Genkit instance
// to avoid auth conflicts with the googleAI plugin.
import './flows/ingest-whatsapp-message-flow';
import './flows/fetch-chat-history-flow';
import './flows/send-chat-message-flow';

// You can add imports for other, AI-related flows here as needed.
// Example: import './flows/some-ai-feature-flow';
