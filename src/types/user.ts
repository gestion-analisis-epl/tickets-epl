export type Role = "solicitante" | "gerente_area" | "mesa_control" | "abogado" | "gerente_juridico" | "admin" | "jefe_zona" | "sitios";

// Roles con cuenta de correo+contrasena, creables desde el panel de Usuarios.
// "solicitante" no entra aqui: se autoregistra por Google (ver
// lib/users.ts ensureSolicitanteDoc), crearlo a mano duplicaria la cuenta.
export const STAFF_ROLES: Role[] = ["mesa_control", "abogado", "gerente_juridico", "admin", "jefe_zona", "sitios"];

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

// Solo consulta tickets en Pre-Cierre/Cierre, a traves de resumenesContrato (ver firestore.rules).
// No lee la coleccion tickets. Sincronizar a mano con firestore.rules isJefeZona().
export function esJefeZona(role: Role | null | undefined): boolean {
  return role === "jefe_zona";
}

// Solo lectura del resumen del contrato en Pre-Cierre/Cierre. No lee tickets, historial ni
// conversacion. Sincronizar a mano con firestore.rules isSitios().
export function esSitios(role: Role | null | undefined): boolean {
  return role === "sitios";
}

// Roles que solo consultan resumenesContrato (sin acceso a la coleccion tickets).
export const ROLES_SOLO_RESUMEN: Role[] = ["jefe_zona", "sitios"];
export function esRolSoloResumen(role: Role | null | undefined): boolean {
  return !!role && ROLES_SOLO_RESUMEN.includes(role);
}

// Sitios es de solo lectura: unicamente el jefe de zona da el visto bueno.
export function puedeDarVistoBueno(role: Role | null | undefined): boolean {
  return esJefeZona(role);
}

// Dashboard: solo admin y el equipo Legal. Solicitante y gerente_area ven sus tickets, no los KPIs del area.
// Es una comodidad de UI: no hay regla de Firestore especifica, el dashboard se calcula con lo que cada rol ya puede leer.
export const ROLES_DASHBOARD: Role[] = ["mesa_control", "abogado", "gerente_juridico", "admin"];
export function puedeVerDashboard(role: Role | null | undefined): boolean {
  return !!role && ROLES_DASHBOARD.includes(role);
}

export interface AppUser {
  uid: string;
  nombre: string;
  email: string;
  role: Role;
  areaEmpresa?: string; // solo aplica a solicitantes
  activo: boolean;
}
