import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, serverTimestamp } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import { db, auth } from "./firebase";
import type { Role } from "@/types/user";

export interface UserDoc {
  nombre: string;
  email: string;
  role: Role;
  activo: boolean;
}

export interface UserRow extends UserDoc {
  uid: string;
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

/*
 * Se llama despues de un login con Google exitoso. Si es la primera vez que
 * esta persona entra (con ESTE uid), se le crea su doc con role "solicitante"
 * (unico rol que un usuario puede auto-asignarse — ver firestore.rules). Los
 * demas roles (Legal o admin) se asignan desde la pantalla de Usuarios, y
 * solo un admin puede hacerlo (ver firestore.rules).
 *
 * OJO: si esta persona borro su cuenta de Firebase Auth y volvio a entrar,
 * Firebase le asigna un uid NUEVO (borrar no libera/reutiliza el uid viejo)
 * — el doc anterior en Firestore queda huerfano, ligado a un uid que ya no
 * existe. Para no regresar a "solicitante" a alguien que ya tenia un rol
 * elevado, primero se busca por correo; si aparece un doc huerfano, se le
 * hereda el rol al doc nuevo Y SE BORRA el viejo (si no, quedan dos filas
 * para la misma persona en la pantalla de Usuarios).
 */
export async function ensureSolicitanteDoc(user: FirebaseUser): Promise<UserDoc> {
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data() as UserDoc;

  if (user.email) {
    const dup = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));
    if (!dup.empty) {
      const docViejo = dup.docs[0];
      const heredado = docViejo.data() as UserDoc;
      await setDoc(ref, { ...heredado, creadoEn: serverTimestamp() });
      await deleteDoc(docViejo.ref).catch(() => {
        // Si el borrado falla (ej. reglas), no bloquea el login — el doc
        // nuevo ya quedo bien, solo sobrevive el huerfano por limpiar despues.
      });
      return heredado;
    }
  }

  const nuevo: UserDoc = {
    nombre: user.displayName ?? user.email ?? "Sin nombre",
    email: user.email ?? "",
    role: "solicitante",
    activo: true,
  };
  await setDoc(ref, { ...nuevo, creadoEn: serverTimestamp() });
  return nuevo;
}

// Solo la usa la pantalla de Usuarios (admin) — firestore.rules exige
// isAdmin() para leer todos los docs, asi que si esto se llama sin permisos
// Firestore lo rechaza.
export async function listUsers(): Promise<UserRow[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as UserDoc) }));
}

// Agrega el ID token (el route handler exige role "admin", ver
// lib/api-auth.ts) y propaga el mensaje de error del servidor.
async function apiFetch(path: string, init: RequestInit): Promise<unknown> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("No hay sesion activa.");

  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Ocurrio un error inesperado.");
  return data;
}

export interface CrearUsuarioStaffInput {
  nombre: string;
  email: string;
  role: Role;
}

// Ver app/api/usuarios/route.ts — no hay creacion para "solicitante" (STAFF_ROLES).
export async function crearUsuarioStaff(input: CrearUsuarioStaffInput): Promise<{ uid: string; correoEnviado: boolean }> {
  return apiFetch("/api/usuarios", { method: "POST", body: JSON.stringify(input) }) as Promise<{
    uid: string;
    correoEnviado: boolean;
  }>;
}

export interface ActualizarUsuarioInput {
  nombre?: string;
  email?: string; // solo aplica a cuentas de staff, ver route handler
  role?: Role;
  activo?: boolean; // tambien bloquea/desbloquea el login real (Auth.disabled)
}

export async function actualizarUsuario(uid: string, input: ActualizarUsuarioInput): Promise<void> {
  await apiFetch(`/api/usuarios/${uid}`, { method: "PATCH", body: JSON.stringify(input) });
}

// Borrado definitivo: cuenta de Firebase Auth + doc de Firestore.
export async function eliminarUsuario(uid: string): Promise<void> {
  await apiFetch(`/api/usuarios/${uid}`, { method: "DELETE" });
}
