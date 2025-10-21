
'use server';

import admin from 'firebase-admin';

let adminInitialized = false;

export async function initializeAdmin() {
  if (!adminInitialized) {
    try {
      // Opção 1: Usar arquivo de credenciais (desenvolvimento local)
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      } 
      // Opção 2: Usar JSON inline (produção/Vercel/App Hosting)
      else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(
          process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        );
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      } 
      // Opção 3: Variáveis individuais (fallback)
      else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      }
      // Opção 4: Deixar o ambiente do Google Cloud (App Hosting) descobrir automaticamente
      else {
        admin.initializeApp();
      }
      
      adminInitialized = true;
      console.log('✅ Firebase Admin initialized successfully');
    } catch (error: any) {
      if (error.code === 'app/duplicate-app' && admin.apps.length > 0) {
        console.log('Firebase Admin já foi inicializado.');
        adminInitialized = true;
      } else {
        console.error('❌ Error initializing Firebase Admin:', error);
        throw error;
      }
    }
  }
  
  return admin.firestore();
}

// Exportar o admin para que outros módulos possam usá-lo, como o messaging
export { admin };

