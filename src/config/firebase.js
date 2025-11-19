import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// --- PEGA TUS CREDENCIALES AQUÍ ---
const firebaseConfig = {
apiKey: "AIzaSyDzCLuuPP3m3-PbPmJZaG3wRDfMZ1oxxrk",
  authDomain: "eventos-1ac79.firebaseapp.com",
  projectId: "eventos-1ac79",
  storageBucket: "eventos-1ac79.firebasestorage.app",
  messagingSenderId: "990771481367",
  appId: "1:990771481367:web:01a78e7b720930215b8552",
  measurementId: "G-VEQ8S8S5X6"
};

// Inicializamos y EXPORTAMOS las variables para usarlas en otros archivos
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);