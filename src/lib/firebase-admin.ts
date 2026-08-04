import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FIRESTORE_DATABASE_ID, STORAGE_BUCKET } from "./firebase-config";

// Solo se usa en rutas de servidor (route handlers / server actions).
// En local (dev) usa una service account descargada (FIREBASE_SERVICE_ACCOUNT_JSON)
// o `gcloud auth application-default login`; en despliegue sobre App Hosting /
// Cloud Run, applicationDefault() basta (metadata server).
//
// projectId va explicito: con credenciales de usuario (gcloud ADC) el archivo
// no trae project_id, y sin el verifyIdToken() no puede validar tokens.
//
// Lazy a proposito: si esto se construyera al importar el modulo (top-level),
// un error de configuracion (env var faltante o JSON invalido) tumbaria la
// funcion serverless completa ANTES de que el try/catch de la ruta pudiera
// atraparlo — el cliente solo veria la pagina de error generica de la
// plataforma, sin el mensaje real. Al construirlo dentro del primer uso, el
// throw ocurre ya dentro de la request y el catch de la ruta lo captura.
function buildAdminApp(): App {
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

let cachedAuth: Auth | undefined;
let cachedDb: Firestore | undefined;

export function getAdminAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(buildAdminApp());
  return cachedAuth;
}

export function getAdminDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(buildAdminApp(), FIRESTORE_DATABASE_ID);
  return cachedDb;
}

export function getAdminBucket() {
  return getStorage(buildAdminApp()).bucket(STORAGE_BUCKET);
}
