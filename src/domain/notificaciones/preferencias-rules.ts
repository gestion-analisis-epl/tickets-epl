import type { Role } from "@/types/user";
import type { TipoNotificacion } from "./notificacion";

// Correos que cada rol recibe hoy y que el admin puede apagar. No se pueden agregar
// destinatarios nuevos desde aqui: solo quitar los que ya llegan por su rol.
// El cierre del solicitante no se ofrece: lleva el link de calificacion.
const SOLICITANTE: TipoNotificacion[] = ["creacion_solicitante", "asignacion_solicitante", "reasignacion_solicitante", "cambio_estatus"];

const CORREOS_POR_ROL: Record<Role, TipoNotificacion[]> = {
  admin: ["nuevo_ticket", "cambio_estatus", "cierre"],
  gerente_juridico: ["nuevo_ticket", "cambio_estatus", "cierre"],
  abogado: ["asignacion", "reasignacion"],
  mesa_control: ["asignacion", "reasignacion"],
  solicitante: SOLICITANTE,
  // Como solicitante + el cierre de los tickets que supervisa.
  gerente_area: [...SOLICITANTE, "cierre"],
};

export const ETIQUETA_CORREO: Record<TipoNotificacion, string> = {
  nuevo_ticket: "Nuevo ticket",
  asignacion: "Asignacion de abogado",
  reasignacion: "Reasignacion de abogado",
  cambio_estatus: "Cambio de estatus",
  cierre: "Cierre de ticket",
  creacion_solicitante: "Ticket creado",
  asignacion_solicitante: "Responsable asignado a su ticket",
  reasignacion_solicitante: "Su ticket fue reasignado",
};

export function tiposCorreoEditables(role: Role): TipoNotificacion[] {
  return CORREOS_POR_ROL[role] ?? [];
}

interface ConPreferencias {
  correosDesactivados?: TipoNotificacion[];
}

export function recibeCorreo(usuario: ConPreferencias, tipo: TipoNotificacion): boolean {
  return !usuario.correosDesactivados?.includes(tipo);
}

interface UsuarioDestino extends ConPreferencias {
  email?: string;
  activo?: boolean;
}

// `omitidos`: activos con correo que apagaron este tipo — sirve para no alertar
// "sin destinatarios" cuando el vacio es una decision del admin.
export function filtrarDestinatarios(usuarios: UsuarioDestino[], tipo: TipoNotificacion): { emails: string[]; omitidos: number } {
  const conCorreo = usuarios.filter((u) => u.activo && u.email);
  const activos = conCorreo.filter((u) => recibeCorreo(u, tipo));
  return {
    emails: Array.from(new Set(activos.map((u) => u.email as string))),
    omitidos: conCorreo.length - activos.length,
  };
}

export type ResultadoCorreosDesactivados = { ok: true; tipos: TipoNotificacion[] } | { ok: false; error: string };

export function normalizarCorreosDesactivados(entrada: unknown, role: Role): ResultadoCorreosDesactivados {
  if (!Array.isArray(entrada)) return { ok: false, error: "correosDesactivados debe ser una lista." };
  if (entrada.some((t) => typeof t !== "string")) return { ok: false, error: "correosDesactivados solo admite tipos de correo." };

  const editables = tiposCorreoEditables(role);
  return { ok: true, tipos: editables.filter((t) => entrada.includes(t)) };
}
