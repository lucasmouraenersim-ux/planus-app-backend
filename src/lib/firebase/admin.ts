
'use server';
import admin from 'firebase-admin';

// This function ensures Firebase Admin is initialized only once.
export async function initializeAdmin() {
  if (admin.apps.length === 0) {
    try {
      // In Google Cloud environments (like App Hosting), initializeApp() 
      // with no arguments uses Application Default Credentials.
      admin.initializeApp();
      console.log(`[Firebase Admin] SDK initialized successfully.`);
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
