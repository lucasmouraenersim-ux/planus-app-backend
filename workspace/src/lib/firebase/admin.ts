
import 'server-only';
import admin from 'firebase-admin';

// Re-export specific Firebase Admin sub-modules for clarity and type safety
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

interface AdminInstances {
    app: admin.app.App;
    auth: Auth;
    db: Firestore;
    messaging: Messaging;
}

export async function initializeAdmin(): Promise<AdminInstances> {
  // 1. If already initialized, return the existing instances
  if (admin.apps.length > 0) {
    const existingApp = admin.app();
    return {
      app: existingApp,
      auth: getAuth(existingApp),
      db: getFirestore(existingApp),
      messaging: getMessaging(existingApp),
    };
  }

  // 2. Try to get individual environment variables (more secure method)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // 3. Fallback to the full JSON string (legacy method)
  const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  let certParams: admin.ServiceAccount;

  if (projectId && clientEmail && privateKey) {
    // Option A: Individual variables (Recommended)
    certParams = {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };
  } else if (serviceAccountJSON) {
    // Option B: Full JSON string (Legacy)
    try {
      const parsed = JSON.parse(serviceAccountJSON);
      certParams = {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      };
    } catch (e) {
      console.error("❌ Error parsing FIREBASE_SERVICE_ACCOUNT_KEY JSON from .env:", e);
      throw new Error("Invalid Firebase service account JSON format in environment variables.");
    }
  } else {
    throw new Error('❌ Firebase Admin credentials not found in environment variables.');
  }

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert(certParams),
      projectId: certParams.projectId, // Important for Storage/Auth
    });

    console.log("🔥 Firebase Admin initialized successfully!");

    return {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      messaging: getMessaging(app),
    };
  } catch (error: any) {
    console.error("❌ Firebase Admin initialization failed:", error);
    // Handle race condition where the app might get initialized between the check and initializeApp call
    if (error.code === 'app/duplicate-app') {
        const existingApp = admin.app();
        return { 
          app: existingApp, 
          auth: getAuth(existingApp), 
          db: getFirestore(existingApp), 
          messaging: getMessaging(existingApp) 
        };
    }
    throw error;
  }
}
