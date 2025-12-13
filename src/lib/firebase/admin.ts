import 'server-only';
import admin from 'firebase-admin';

export async function initializeAdmin() {
  // 1. Se já estiver inicializado, retorna a instância
  if (admin.apps.length > 0) {
    return {
      app: admin.app(),
      auth: admin.auth(),
      db: admin.firestore(),
    };
  }

  // 2. Tenta pegar as variáveis individuais (Método Mais Seguro)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // 3. Fallback para o JSON antigo (caso as individuais não existam)
  const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  let certParams;

  if (projectId && clientEmail && privateKey) {
    // Opção A: Variáveis Individuais (Recomendado)
    certParams = {
      projectId,
      clientEmail,
      // Corrige as quebras de linha que o .env às vezes estraga
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };
  } else if (serviceAccountJSON) {
    // Opção B: JSON Completo (Legado)
    try {
      const parsed = JSON.parse(serviceAccountJSON);
      certParams = {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      };
    } catch (e) {
      console.error("❌ Erro ao ler JSON do Firebase:", e);
      throw new Error("Formato inválido no .env (JSON)");
    }
  } else {
    throw new Error('❌ Nenhuma credencial do Firebase Admin encontrada no .env');
  }

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert(certParams),
      projectId: certParams.projectId, // Importante para Storage/Auth
    });

    console.log("🔥 Firebase Admin conectado com sucesso!");

    return {
      app,
      auth: app.auth(),
      db: app.firestore(),
    };
  } catch (error: any) {
    console.error("❌ Falha na inicialização do Admin:", error);
    // Se já existe um app (race condition), tenta retornar ele
    if (error.code === 'app/duplicate-app') {
        const app = admin.app();
        return { app, auth: app.auth(), db: app.firestore() };
    }
    throw error;
  }
}