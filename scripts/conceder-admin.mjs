/*
 * Asigna el rol admin a una cuenta que YA inicio sesion una vez (su doc users/{uid} existe).
 * Escribe en la base que apunten .env.local (NEXT_PUBLIC_FIRESTORE_DATABASE_ID y credenciales),
 * asi que revisa a donde apunta antes de correrlo.
 *
 * Uso: node scripts/conceder-admin.mjs xxales11xx@gmail.com
 */
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local: se usa el entorno actual.
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Falta el correo: node scripts/conceder-admin.mjs <correo>");
  process.exit(1);
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "epl-tickets";
if (!projectId) {
  console.error("Falta NEXT_PUBLIC_FIREBASE_PROJECT_ID en .env.local.");
  process.exit(1);
}

const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const app = initializeApp({ credential: json ? cert(JSON.parse(json)) : applicationDefault(), projectId });

try {
  const cuenta = await getAuth(app).getUserByEmail(email);
  const ref = getFirestore(app, databaseId).collection("users").doc(cuenta.uid);
  const doc = await ref.get();
  if (!doc.exists) {
    throw new Error("Esa cuenta aun no tiene documento en users: inicia sesion una vez en la app y vuelve a correr el script.");
  }
  await ref.update({ role: "admin", activo: true });
  console.log(`Listo: ${email} (${cuenta.uid}) ahora es admin en ${projectId}/${databaseId}. Rol anterior: ${doc.data()?.role}.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
