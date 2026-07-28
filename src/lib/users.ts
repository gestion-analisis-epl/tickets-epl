import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import { db } from "./firebase";
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

export async function updateUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role });
}
