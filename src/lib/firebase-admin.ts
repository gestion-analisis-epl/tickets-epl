import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FIRESTORE_DATABASE_ID, STORAGE_BUCKET } from "./firebase-config";

// Solo se usa en rutas de servidor (route handlers / server actions).
// En local (dev) usa una service account descargada (FIREBASE_SERVICE_ACCOUNT_JSON);
// en despliegue sobre App Hosting / Cloud Run, applicationDefault() basta (metadata server).
function buildAdminApp() {
  if (getApps().length) return getApps()[0];

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  }
  return initializeApp({ credential: applicationDefault() });
}

export const adminApp = buildAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
export const adminBucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
