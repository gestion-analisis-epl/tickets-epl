import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { FIRESTORE_DATABASE_ID, STORAGE_BUCKET } from "./firebase-config";

// Mismo proyecto Firebase que KRONOS (kronos-7ebd7) — misma config de Auth.
// Llenar estas variables en .env.local con los mismos valores que usa
// kronos-erp/frontend (es el mismo proyecto). Ver .env.example.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
export const storage = getStorage(app, `gs://${STORAGE_BUCKET}`);

// Explicito aunque ya sea el default del SDK: la sesion sobrevive a cerrar el
// navegador (no solo la pestaña). Sin esto dependeriamos del comportamiento
// implicito de la libreria, que puede variar entre versiones. Solo en cliente
// (Next hace SSR de este modulo tambien) y sin dejar una promesa sin manejar.
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}
