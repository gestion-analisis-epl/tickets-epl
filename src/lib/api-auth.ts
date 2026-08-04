import { getAdminAuth, getAdminDb } from "./firebase-admin";

// Status HTTP que debe devolver el route handler que la atrape.
export class ApiAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function verifyCallerToken(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!idToken) throw new ApiAuthError(401, "Falta el token de autenticacion.");

  try {
    return (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch (err) {
    // Mensaje al cliente generico; el error real (que puede ser de
    // configuracion, no del token) se loguea aparte.
    console.error("verifyIdToken fallo:", err);
    throw new ApiAuthError(401, "Token de autenticacion invalido o expirado.");
  }
}

// Las rutas bajo app/api/usuarios/ usan Admin SDK (bypassa Firestore Rules)
// porque gestionan cuentas ajenas — algo que Rules y el SDK de cliente no
// permiten. El permiso se valida aqui a mano contra el doc del caller.
export async function requireAdmin(request: Request): Promise<string> {
  const callerUid = await verifyCallerToken(request);

  const callerDoc = await getAdminDb().collection("users").doc(callerUid).get();
  if (callerDoc.data()?.role !== "admin") {
    throw new ApiAuthError(403, "Solo una cuenta admin puede hacer esto.");
  }

  return callerUid;
}
