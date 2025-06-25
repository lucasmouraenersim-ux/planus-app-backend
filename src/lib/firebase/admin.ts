'use server';
import admin from 'firebase-admin';

// This function ensures Firebase Admin is initialized only once.
export async function initializeAdmin() {
  if (!admin.apps.length) {
    try {
      // In a Google Cloud environment (like App Hosting), the SDK
      // can auto-discover credentials by calling initializeApp with no arguments.
      admin.initializeApp();
      console.log('[Firebase Admin] SDK initialized successfully using environment credentials.');
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
