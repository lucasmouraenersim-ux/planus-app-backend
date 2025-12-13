
import 'server-only';
import admin from 'firebase-admin';

interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function formatPrivateKey(key: string) {
  return key.replace(/\\n/g, '\n');
}

export async function initializeAdmin() {
  if (admin.apps.length > 0) {
    return {
      app: admin.app(),
      auth: admin.auth(),
      db: admin.firestore(),
      messaging: admin.messaging(),
    };
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    throw new Error('❌ FIREBASE_SERVICE_ACCOUNT_KEY não encontrada no .env. A chave da conta de serviço é necessária para operações de administrador.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);

    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("🔥 Firebase Admin Inicializado com Sucesso!");

    return {
      app,
      auth: app.auth(),
      db: app.firestore(),
      messaging: app.messaging(),
    };
  } catch (error) {
    console.error("❌ Erro ao inicializar Firebase Admin:", error);
    // Lança um erro mais específico se a chave for inválida.
    if (error instanceof Error && error.message.includes('json')) {
        throw new Error('Falha ao fazer o parse da FIREBASE_SERVICE_ACCOUNT_KEY. Verifique se o JSON está formatado corretamente no .env.');
    }
    throw new Error('Falha na configuração do Firebase Admin. Verifique as credenciais da conta de serviço.');
  }
}
