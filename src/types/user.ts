export type Role = "solicitante" | "gerente_area" | "mesa_control" | "abogado" | "gerente_juridico" | "admin";

// Roles con cuenta de correo+contrasena, creables desde el panel de Usuarios.
// "solicitante" no entra aqui: se autoregistra por Google (ver
// lib/users.ts ensureSolicitanteDoc), crearlo a mano duplicaria la cuenta.
export const STAFF_ROLES: Role[] = ["mesa_control", "abogado", "gerente_juridico", "admin"];

// Roles del flujo operativo de tickets — reciben la notificacion de "nuevo
// ticket" y pueden enlazarse a un abogado del catalogo (ver lib/notificaciones.ts).
// admin queda fuera: no atiende tickets (ver firestore.rules isAdmin() vs isLegalStaff()).
export const LEGAL_STAFF_ROLES: Role[] = ["mesa_control", "abogado", "gerente_juridico"];

// TEMPORAL: gerente_juridico tiene los mismos permisos que admin (para poder
// gestionar usuarios/catalogo sin depender de una cuenta admin dedicada).
// Sincronizar a mano con firestore.rules isAdmin().
export const ADMIN_LIKE_ROLES: Role[] = ["admin", "gerente_juridico"];
export function isAdminRole(role: Role | null | undefined): boolean {
  return !!role && (ADMIN_LIKE_ROLES as Role[]).includes(role);
}

// Roles que entran con su cuenta de Google y crean tickets propios (no son staff de Legal).
// gerente_area ademas ve, sin poder editarlos, los tickets de los usuarios de su supervisaUids.
export const SOLICITANTE_ROLES: Role[] = ["solicitante", "gerente_area"];
export function isSolicitanteRole(role: Role | null | undefined): boolean {
  return !!role && SOLICITANTE_ROLES.includes(role);
}

export function puedeSupervisar(role: Role | null | undefined): boolean {
  return role === "gerente_area";
}

export interface AppUser {
  uid: string;
  nombre: string;
  email: string;
  role: Role;
  areaEmpresa?: string; // solo aplica a solicitantes
  activo: boolean;
}
