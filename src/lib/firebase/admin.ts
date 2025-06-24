
import * as admin from 'firebase-admin';

/**
 * Initializes the Firebase Admin SDK if not already initialized.
 * This is a singleton pattern to prevent re-initialization in serverless environments.
 * It explicitly uses Application Default Credentials.
 */
function ensureAdminInitialized() {
  if (!admin.apps.length) {
    try {
      console.log("[ADMIN_SDK_LIB] Attempting to initialize Firebase Admin SDK...");
      // Explicitly use Application Default Credentials. This is the standard for GCP environments.
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log("[ADMIN_SDK_LIB] Firebase Admin SDK initialized successfully.");
    } catch (e: any) {
      console.error('[ADMIN_SDK_LIB] CRITICAL: Firebase admin initialization error.', e.message);
      // This can happen in local dev if GOOGLE_APPLICATION_CREDENTIALS is not set.
      // It's a critical error for production.
    }
  }
}

/**
 * Gets the initialized Firebase Admin namespace.
 * Call this to access admin features like admin.firestore.FieldValue.
 * @returns The Firebase Admin namespace.
 */
export function getFirebaseAdmin() {
  ensureAdminInitialized();
  return admin;
}

/**
 * Gets the initialized Firestore instance from the Admin SDK.
 * Call this to perform database operations with admin privileges.
 * @returns The Firestore instance.
 */
export const adminDb = (() => {
  ensureAdminInitialized();
  return admin.firestore();
})();
