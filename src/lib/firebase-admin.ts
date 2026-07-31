import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FIRESTORE_DATABASE_ID, STORAGE_BUCKET } from "./firebase-config";

// Solo se usa en rutas de servidor (route handlers / server actions).
// En local (dev) usa una service account descargada (FIREBASE_SERVICE_ACCOUNT_JSON)
// o `gcloud auth application-default login`; en despliegue sobre App Hosting /
// Cloud Run, applicationDefault() basta (metadata server).
//
// projectId va explicito: con credenciales de usuario (gcloud ADC) el archivo
// no trae project_id, y sin el verifyIdToken() no puede validar tokens.
function buildAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Falta NEXT_PUBLIC_FIREBASE_PROJECT_ID en el entorno del servidor — revisa tu .env.local."
    );
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountJson)), projectId });
  }
  return initializeApp({ credential: applicationDefault(), projectId });
}

export const adminApp = buildAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp, FIRESTORE_DATABASE_ID);
export const adminBucket = getStorage(adminApp).bucket(STORAGE_BUCKET);
