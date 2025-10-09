// Script para fazer upload dos tiles para Firebase Storage
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

async function uploadFile(file, path) {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
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
      const response = await fetch(file);
      const blob = await response.blob();
      await uploadFile(blob, path);
    } catch (error) {
      console.error(`Erro ao processar ${file}:`, error);
    }
  }
  
  console.log('🎉 Upload concluído!');
}

// Executar upload
uploadAllTiles();
