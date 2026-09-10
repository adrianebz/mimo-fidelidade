// Firebase Client SDK Configuration for MIMO (Project: mimo-2d6eb)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

export const firebaseConfig = {
  apiKey: "AIzaSyCF6mfQU8eLn8xGvRkogYzofqcw390mhBo",
  authDomain: "mimo-2d6eb.firebaseapp.com",
  projectId: "mimo-2d6eb",
  storageBucket: "mimo-2d6eb.firebasestorage.app",
  messagingSenderId: "569634463537",
  appId: "1:569634463537:web:5b76316ab85ca0b34f9a10"
};

export const FIREBASE_HOSTING_URL = "https://mimo-fidelidade.web.app";
export const FIREBASE_PROJECT_ID = "mimo-2d6eb";

// Inicializa ou reaproveita a app Firebase
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
// Mesma região das Cloud Functions (criarCartao/carimbar/resgatar/autenticarAdmin/autenticarLojista)
export const functions = getFunctions(app, 'southamerica-east1');
