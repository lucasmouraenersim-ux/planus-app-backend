
import * as admin from 'firebase-admin';

/**
 * Initializes the Firebase Admin SDK if not already initialized.
 * This is a singleton pattern to prevent re-initialization in serverless environments.
 */
function ensureAdminInitialized() {
  if (!admin.apps.length) {
    try {
      // When running on Google Cloud (like App Hosting), initializeApp() with no args
      // will automatically use the service account credentials.
      admin.initializeApp();
      console.log("[ADMIN_SDK_LIB] Firebase Admin SDK initialized successfully via lib.");
    } catch (e) {
      console.error('[ADMIN_SDK_LIB] Firebase admin initialization error', e);
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
export function getAdminFirestore() {
  ensureAdminInitialized();
  return admin.firestore();
}
