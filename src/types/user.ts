export type Role = "solicitante" | "mesa_control" | "abogado" | "gerente_juridico" | "admin";

// Roles con cuenta de correo+contrasena, creables desde el panel de Usuarios.
// "solicitante" no entra aqui: se autoregistra por Google (ver
// lib/users.ts ensureSolicitanteDoc), crearlo a mano duplicaria la cuenta.
export const STAFF_ROLES: Role[] = ["mesa_control", "abogado", "gerente_juridico", "admin"];

export interface AppUser {
  uid: string;
  nombre: string;
  email: string;
  role: Role;
  areaEmpresa?: string; // solo aplica a solicitantes
  activo: boolean;
}
