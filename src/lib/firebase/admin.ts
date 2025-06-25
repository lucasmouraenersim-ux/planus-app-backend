'use server';
import admin from 'firebase-admin';

// This function ensures Firebase Admin is initialized only once.
export async function initializeAdmin() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        // In a Google Cloud environment (like App Hosting), the SDK
        // can auto-discover credentials. Explicitly setting projectId can help.
        projectId: 'energisa-invoice-editor',
      });
      console.log('[Firebase Admin] SDK initialized successfully.');
    } catch (error: any) {
      // This can happen in serverless environments with multiple concurrent executions.
      // If it's a duplicate app error, we can safely ignore it and use the existing app.
      if (error.code !== 'app/duplicate-app') {
        console.error('CRITICAL: Firebase admin initialization error:', error);
      }
    }
  }
  // Return the firestore instance
  return admin.firestore();
}
