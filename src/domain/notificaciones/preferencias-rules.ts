import type { Role } from "@/types/user";
import type { TipoNotificacion } from "./notificacion";

// Correos que cada rol recibe hoy y que el admin puede apagar. No se pueden agregar
// destinatarios nuevos desde aqui: solo quitar los que ya llegan por su rol.
// El cierre del solicitante no se ofrece: lleva el link de calificacion.
const SOLICITANTE: TipoNotificacion[] = [
  "creacion_solicitante", "asignacion_solicitante", "reasignacion_solicitante", "cambio_estatus",
  "comentario_ticket", "cambios_solicitados",
];

// Avisos de la conversacion de Pre-Cierre: el abogado asignado se identifica por abogadoId (puede tener
// rol abogado, mesa_control o gerente_juridico), por eso esos roles ofrecen ambos tipos.
const CORREOS_POR_ROL: Record<Role, TipoNotificacion[]> = {
  admin: ["nuevo_ticket", "cambio_estatus", "cierre", "comentario_ticket"],
  gerente_juridico: ["nuevo_ticket", "cambio_estatus", "cierre", "comentario_ticket", "cambios_solicitados"],
  abogado: ["asignacion", "reasignacion", "comentario_ticket", "cambios_solicitados"],
  mesa_control: ["asignacion", "reasignacion", "comentario_ticket", "cambios_solicitados"],
  solicitante: SOLICITANTE,
  // Como solicitante + el cierre de los tickets que supervisa.
  gerente_area: [...SOLICITANTE, "cierre"],
  jefe_zona: ["pre_cierre", "comentario_ticket"],
  // Rol Sitios: solo el aviso de Pre-Cierre; no participa en la conversacion.
  sitios: ["pre_cierre"],
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
  pre_cierre: "Ticket en Pre-Cierre",
  comentario_ticket: "Comentario en la conversacion de un ticket",
  cambios_solicitados: "Cambios solicitados por el jefe de zona",
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
