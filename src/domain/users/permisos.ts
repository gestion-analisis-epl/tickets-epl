import type { Role } from "@/types/user";

// Ids sin puntos: se guardan como claves de un mapa en users/{uid}.permisos y un punto se leeria
// como ruta anidada en un update de Firestore. Sincronizar a mano con firestore.rules baseDelRol().
export const PERMISOS = [
  "asignar_tickets",
  "eliminar_tickets",
  "gestionar_usuarios",
  "editar_catalogo",
  "ver_historial",
  "usar_mantenimiento",
] as const;

export type Permiso = (typeof PERMISOS)[number];

// Excepciones por usuario sobre lo que da su rol: true concede, false quita, ausente hereda.
export type AjustesPermisos = Partial<Record<Permiso, boolean>>;

export const ETIQUETA_PERMISO: Record<Permiso, string> = {
  asignar_tickets: "Asignar o reasignar abogado",
  eliminar_tickets: "Eliminar tickets",
  gestionar_usuarios: "Gestionar usuarios",
  editar_catalogo: "Editar catalogo y categorias",
  ver_historial: "Ver el historial de cualquier ticket",
  usar_mantenimiento: "Usar mantenimiento",
};

const ADMIN_LIKE: Role[] = ["admin", "gerente_juridico"];

// Lo que cada rol puede hacer sin ajustes (el comportamiento previo a los permisos granulares).
export const PERMISOS_BASE: Record<Permiso, Role[]> = {
  asignar_tickets: ADMIN_LIKE,
  eliminar_tickets: ["admin"],
  gestionar_usuarios: ADMIN_LIKE,
  editar_catalogo: ADMIN_LIKE,
  ver_historial: ADMIN_LIKE,
  usar_mantenimiento: ADMIN_LIKE,
};

// Solo el rol admin puede tener estos, ni el ajuste de un usuario los concede a otro rol.
const SOLO_ROL_ADMIN: Permiso[] = ["eliminar_tickets"];

export interface SujetoPermisos {
  role: Role;
  permisos?: AjustesPermisos | null;
}

export function tienePermiso(sujeto: SujetoPermisos, permiso: Permiso): boolean {
  if (SOLO_ROL_ADMIN.includes(permiso) && sujeto.role !== "admin") return false;
  const ajuste = sujeto.permisos?.[permiso];
  if (typeof ajuste === "boolean") return ajuste;
  return PERMISOS_BASE[permiso].includes(sujeto.role);
}

export function permisoDelRol(role: Role, permiso: Permiso): boolean {
  return PERMISOS_BASE[permiso].includes(role);
}

export function puedeRecibirAjuste(role: Role, permiso: Permiso): boolean {
  return !SOLO_ROL_ADMIN.includes(permiso) || role === "admin";
}

export type ResultadoAjustes = { ok: true; ajustes: AjustesPermisos } | { ok: false; error: string };

// Valida lo recibido del cliente y deja solo las excepciones reales (las que difieren del rol).
export function normalizarAjustes(entrada: unknown, role: Role): ResultadoAjustes {
  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) {
    return { ok: false, error: "permisos debe ser un objeto." };
  }
  const ajustes: AjustesPermisos = {};
  for (const [clave, valor] of Object.entries(entrada)) {
    if (!(PERMISOS as readonly string[]).includes(clave)) return { ok: false, error: `Permiso desconocido: ${clave}.` };
    if (typeof valor !== "boolean") return { ok: false, error: `El permiso ${clave} debe ser verdadero o falso.` };
    const permiso = clave as Permiso;
    if (valor && !puedeRecibirAjuste(role, permiso)) {
      return { ok: false, error: `${ETIQUETA_PERMISO[permiso]} solo puede tenerlo el rol admin.` };
    }
    if (valor !== permisoDelRol(role, permiso)) ajustes[permiso] = valor;
  }
  return { ok: true, ajustes };
}

export interface CuentaGestion {
  uid: string;
  role: Role;
  activo: boolean;
  permisos?: AjustesPermisos | null;
}

// Tras el cambio propuesto (`despues` = null si se borra la cuenta), debe quedar al menos una cuenta
// activa que pueda gestionar usuarios; si no, nadie podria volver a corregir permisos.
export function quedaGestorDeUsuarios(cuentas: CuentaGestion[], uid: string, despues: CuentaGestion | null): boolean {
  const resultantes = cuentas.filter((c) => c.uid !== uid).concat(despues ? [despues] : []);
  return resultantes.some((c) => c.activo && tienePermiso(c, "gestionar_usuarios"));
}
