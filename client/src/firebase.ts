// Firebase Client SDK — Boomii
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

/*
 * O projeto no Firebase continua sendo `mimo-2d6eb`, de antes da troca de marca.
 * O ID de um projeto é imutável: renomeá-lo exigiria criar um projeto novo e
 * migrar Firestore, Storage, Functions e credenciais. Por decisão do produto,
 * a marca nova vive no domínio (boomii.com.br) e no site de Hosting, e o ID
 * antigo permanece apenas como identificador interno da infraestrutura.
 *
 * Os valores abaixo podem ser sobrescritos por VITE_FIREBASE_* em
 * client/.env.local. Sobrescreva os SEIS de uma vez: apiKey, appId e
 * messagingSenderId são opacos e pertencem a um projeto específico, então
 * misturá-los com o projectId de outro projeto gera uma config que não
 * autentica em nenhum dos dois.
 */
const PROJETO = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'mimo-2d6eb';

/*
 * Sobre o `authDomain` e a marca antiga:
 *
 * Ele só é usado no handshake OAuth de login federado (signInWithPopup /
 * signInWithRedirect), que redireciona o navegador para
 * `https://<authDomain>/__/auth/handler`. Este projeto autentica apenas por
 * `signInWithEmailAndPassword`, que fala direto com identitytoolkit.googleapis.com
 * — ou seja, o authDomain nunca é visitado nem exibido ao usuário. Ele existe
 * aqui só como string de configuração.
 *
 * Pode ser trocado por um domínio próprio: o Firebase Hosting serve os arquivos
 * de `/__/auth/` em qualquer domínio personalizado ligado ao mesmo projeto.
 * Depois que `www.boomii.com.br` estiver conectado e com SSL emitido, defina
 * VITE_FIREBASE_AUTH_DOMAIN=www.boomii.com.br e adicione esse domínio em
 * Authentication → Settings → Authorized domains.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyCF6mfQU8eLn8xGvRkogYzofqcw390mhBo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? `${PROJETO}.firebaseapp.com`,
  projectId: PROJETO,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? `${PROJETO}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '569634463537',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:569634463537:web:5b76316ab85ca0b34f9a10'
};

/** URL pública do site. Passa a ser o domínio próprio quando o DNS propagar. */
export const FIREBASE_HOSTING_URL =
  import.meta.env.VITE_FIREBASE_HOSTING_URL ?? 'https://boomii-fidelidade.web.app';
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

// Inicializa ou reaproveita a app Firebase
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
// Mesma região das Cloud Functions (criarCartao/carimbar/resgatar/autenticarAdmin/autenticarLojista)
export const functions = getFunctions(app, 'southamerica-east1');
