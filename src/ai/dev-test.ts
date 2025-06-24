// src/ai/dev-test.ts
/**
 * @fileOverview A script for manually testing server actions from the terminal.
 */

import { fetchChatHistory } from './flows/fetch-chat-history-flow';

// Hardcode a known leadId from your logs to test
// From the latest log: 1Abn6yunFeEUw5lv4v2I
const LEAD_ID_TO_TEST = '1Abn6yunFeEUw5lv4v2I'; 

async function runTest() {
  console.log(`[DEV_TEST] Running test for fetchChatHistory with leadId: ${LEAD_ID_TO_TEST}`);
  
  try {
    const chatHistory = await fetchChatHistory(LEAD_ID_TO_TEST);

    console.log('--- [DEV_TEST] TEST RESULT ---');
    if (chatHistory && chatHistory.length > 0) {
      console.log(`Successfully fetched ${chatHistory.length} messages:`);
      console.log(JSON.stringify(chatHistory, null, 2));
    } else if (chatHistory) {
      console.log('Function executed successfully, but no messages were found for this lead.');
      console.log('This might mean the crm_lead_chats document exists but the "messages" array is empty, or the document does not exist.');
    } else {
        console.log('Function returned an undefined or null result.');
    }
    console.log('---------------------------');
    
  } catch (error) {
    console.error('[DEV_TEST] An error occurred while running the test:');
    console.error(error);
  }
}

// Execute the test function
runTest();
