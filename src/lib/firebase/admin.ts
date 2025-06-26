
'use server';
import admin from 'firebase-admin';

const PROJECT_ID = "energisa-invoice-editor";

// This function ensures Firebase Admin is initialized only once.
export async function initializeAdmin() {
  if (!admin.apps.length) {
    try {
      // Explicitly initialize with the project ID to avoid ambiguity in server environments.
      admin.initializeApp({
        projectId: PROJECT_ID,
      });
      console.log(`[Firebase Admin] SDK initialized successfully for project: ${PROJECT_ID}.`);
    } catch (error: any) {
      // This can happen in serverless environments with multiple concurrent executions.
      // If it's a duplicate app error, we can safely ignore it and use the existing app.
      if (error.code !== 'app/duplicate-app') {
        console.error('CRITICAL: Firebase admin initialization error:', error);
        // Re-throw the error to ensure it's caught by the calling function.
        throw error;
      }
    }
  }
  // Return the firestore instance
  return admin.firestore();
}
