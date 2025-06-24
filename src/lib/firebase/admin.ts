import * as admin from 'firebase-admin';

// Garante que o app do Firebase Admin seja inicializado apenas uma vez.
// Isso evita erros de "app já existe" em ambientes de desenvolvimento com hot-reloading.
if (!admin.apps.length) {
  admin.initializeApp();
}

// Exporta a instância do Firestore do Admin SDK para ser usada em funções de backend/servidor.
export const adminDb = admin.firestore();

// Exporta o namespace 'admin' para acesso a outras funcionalidades, como o FieldValue.
export { admin };
