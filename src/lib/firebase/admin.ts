// src/lib/firebase/admin.ts
import * as admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';

let adminApp: App;

// This pattern ensures the Admin SDK is initialized only once.
if (!admin.apps.length) {
  try {
    // When deployed to Firebase/Google Cloud, initializeApp() with no arguments
    // will use Application Default Credentials.
    adminApp = admin.initializeApp();
    console.log('Firebase Admin SDK Initialized.');
  } catch (e: any) {
    console.error('Firebase Admin SDK initialization error', e.stack);
  }
} else {
  adminApp = admin.app();
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth };
