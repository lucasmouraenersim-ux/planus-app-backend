
'use server';

import admin from 'firebase-admin';

let adminInitialized = false;

// Interface para o retorno da função
interface AdminServices {
  db: admin.firestore.Firestore;
  auth: admin.auth.Auth;
  messaging: admin.messaging.Messaging;
}

export async function initializeAdmin(): Promise<AdminServices> {
  if (!adminInitialized) {
    try {
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      
      if (serviceAccountKey) {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      } else {
        // Fallback para o auto-discovery do ambiente Google Cloud
        admin.initializeApp();
      }
      
      adminInitialized = true;
      console.log('✅ Firebase Admin initialized successfully');
    } catch (error: any) {
      if (error.code === 'app/duplicate-app') {
        if (!adminInitialized) {
          console.log('Firebase Admin já foi inicializado (código de erro duplicado).');
          adminInitialized = true;
        }
      } else {
        console.error('❌ Error initializing Firebase Admin:', error);
        throw new Error('Failed to initialize Firebase Admin SDK.');
      }
    }
  }
  
  return {
    db: admin.firestore(),
    auth: admin.auth(),
    messaging: admin.messaging(),
  };
}
