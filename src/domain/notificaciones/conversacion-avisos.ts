import type { Role } from "@/types/user";
import type { Ticket } from "@/types/ticket";
import type { NuevoComentario } from "@/types/comentario";
import type { TipoNotificacion } from "./notificacion";
import { filtrarDestinatarios } from "./preferencias-rules";

export type TipoAvisoConversacion = Extract<TipoNotificacion, "comentario_ticket" | "cambios_solicitados">;

// Solo los dispara el servidor (sus destinatarios dependen del autor y del ticket);
// /api/notificaciones/email los rechaza.
export const TIPOS_AVISO_CONVERSACION: readonly TipoAvisoConversacion[] = ["comentario_ticket", "cambios_solicitados"];

export function esTipoSoloServidor(tipo: unknown): boolean {
  return typeof tipo === "string" && (TIPOS_AVISO_CONVERSACION as readonly string[]).includes(tipo);
}

export interface UsuarioAviso {
  uid: string;
  role: Role;
  activo?: boolean;
  email?: string;
  abogadoId?: string;
  correosDesactivados?: TipoNotificacion[];
}

export type EnlaceAviso = "tickets" | "pre-cierre";

export interface DestinatarioAviso {
  usuario: UsuarioAviso;
  enlace: EnlaceAviso;
}

// Comentario: dueno, abogado asignado, gerente juridico y admin activos, y jefes de zona activos, menos
// el autor. Solo hay comentarios en tickets que ya entraron a Pre-Cierre, y en esos el jefe de zona conserva
// el acceso en cualquier etapa (decision del usuario), asi que /pre-cierre/{id} siempre abre.
// Cambios solicitados: abogado asignado y dueno.
export function destinatariosAviso(
  tipo: TipoAvisoConversacion,
  ticket: Pick<Ticket, "solicitanteId" | "abogadoAsignadoId" | "estatus">,
  usuarios: UsuarioAviso[],
  autorUid: string
): DestinatarioAviso[] {
  const porUid = new Map<string, DestinatarioAviso>();
  const agregar = (usuario: UsuarioAviso, enlace: EnlaceAviso) => {
    if (usuario.uid === autorUid || porUid.has(usuario.uid)) return;
    porUid.set(usuario.uid, { usuario, enlace });
  };

  // El solicitante se trata como activo, igual que solicitanteDestino en notificaciones-email.ts.
  const dueno = usuarios.find((u) => u.uid === ticket.solicitanteId);
  if (dueno) agregar({ ...dueno, activo: true }, "tickets");

  const abogado = ticket.abogadoAsignadoId
    ? usuarios.find((u) => u.activo && u.abogadoId === ticket.abogadoAsignadoId)
    : undefined;
  if (abogado) agregar(abogado, "tickets");

  if (tipo === "comentario_ticket") {
    for (const u of usuarios) {
      if (u.activo && (u.role === "gerente_juridico" || u.role === "admin")) agregar(u, "tickets");
    }
    for (const u of usuarios) {
      if (u.activo && u.role === "jefe_zona") agregar(u, "pre-cierre");
    }
  }

  return Array.from(porUid.values());
}

// La campana llega a todos los destinatarios; el correo, solo a quien no lo apago.
export function correosPorEnlace(destinatarios: DestinatarioAviso[], tipo: TipoAvisoConversacion): Record<EnlaceAviso, string[]> {
  const de = (enlace: EnlaceAviso) =>
    filtrarDestinatarios(destinatarios.filter((d) => d.enlace === enlace).map((d) => d.usuario), tipo).emails;
  return { tickets: de("tickets"), "pre-cierre": de("pre-cierre") };
}

// Nunca incluye el texto del comentario.
export function mensajeAviso(tipo: TipoAvisoConversacion, folio: string, autorNombre: string): string {
  return tipo === "cambios_solicitados"
    ? `${autorNombre} pidio cambios en el ticket ${folio}. Regreso a Proceso en tramite.`
    : `${autorNombre} comento en el ticket ${folio}.`;
}

export type DecisionAvisoComentario = "avisar" | "ya_avisado" | "prohibido";

export function decidirAvisoComentario(
  comentario: Pick<NuevoComentario, "autorUid" | "tipo" | "eliminado" | "avisoEnviado"> | null,
  uid: string
): DecisionAvisoComentario {
  if (!comentario || comentario.autorUid !== uid || comentario.tipo !== "comentario") return "prohibido";
  if (comentario.avisoEnviado || comentario.eliminado) return "ya_avisado";
  return "avisar";
}
