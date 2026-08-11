import type { User as FirebaseUser } from "firebase/auth";
import { auth } from "./firebase";
import { firestoreUserRepository } from "@/infrastructure/firestore/user-repository";
import { createUserService } from "@/domain/users/user-service";
import type { UserDoc } from "@/domain/users/user";
import type { Role } from "@/types/user";

export type { UserDoc, UserRow } from "@/domain/users/user";

const userService = createUserService(firestoreUserRepository);

export const getUserDoc = userService.getUserDoc;
export const listUsers = userService.listUsers;

export function ensureSolicitanteDoc(user: FirebaseUser): Promise<UserDoc> {
  return userService.ensureSolicitanteDoc(user);
}

// Agrega el ID token y propaga el mensaje de error del servidor.
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
  abogadoId?: string | null; // null para desvincular
}

export async function actualizarUsuario(uid: string, input: ActualizarUsuarioInput): Promise<void> {
  await apiFetch(`/api/usuarios/${uid}`, { method: "PATCH", body: JSON.stringify(input) });
}

// Borrado definitivo: cuenta de Firebase Auth + doc de Firestore.
export async function eliminarUsuario(uid: string): Promise<void> {
  await apiFetch(`/api/usuarios/${uid}`, { method: "DELETE" });
}
