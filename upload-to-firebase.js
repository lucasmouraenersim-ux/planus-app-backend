// Script para fazer upload dos tiles para Firebase Storage
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import fs from 'fs'; // Import fs to read files from disk

const firebaseConfig = {
  apiKey: "AIzaSyASyZjkbeiSqh9fEaYDwuS9diyIDUhEQeQ",
  authDomain: "energisa-invoice-editor.firebaseapp.com",
  projectId: "energisa-invoice-editor",
  storageBucket: "energisa-invoice-editor.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function uploadFile(fileBuffer, path) {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, fileBuffer);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`✅ Upload realizado: ${path}`);
    return downloadURL;
  } catch (error) {
    console.error(`❌ Erro no upload de ${path}:`, error);
    throw error;
  }
}

async function uploadAllTiles() {
  console.log('🚀 Iniciando upload dos tiles meteorológicos...');
  
  const filesToUpload = [
    { file: 'public/meteo_tiles/cape_tile.png', path: 'meteo_tiles/cape_tile.png' },
    { file: 'public/meteo_tiles/srh_tile.png', path: 'meteo_tiles/srh_tile.png' },
    { file: 'public/meteo_tiles/metadata.json', path: 'meteo_tiles/metadata.json' }
  ];

  for (const { file, path } of filesToUpload) {
    try {
      // Read the file from the local file system
      if (!fs.existsSync(file)) {
          console.warn(`⚠️  Arquivo não encontrado: ${file}. Pulando.`);
          continue;
      }
      const fileBuffer = fs.readFileSync(file);
      await uploadFile(fileBuffer, path);
    } catch (error) {
      console.error(`Erro ao processar ${file}:`, error);
    }
  }
  
  console.log('🎉 Upload concluído!');
}

// Executar upload
uploadAllTiles();
