import type { TipoNotificacion } from "./notificacion";

export type TipoAvisoConversacion = Extract<TipoNotificacion, "comentario_ticket" | "cambios_solicitados">;

// Solo los dispara el servidor (sus destinatarios dependen del autor y del ticket);
// /api/notificaciones/email los rechaza.
export const TIPOS_AVISO_CONVERSACION: readonly TipoAvisoConversacion[] = ["comentario_ticket", "cambios_solicitados"];

export function esTipoSoloServidor(tipo: unknown): boolean {
  return typeof tipo === "string" && (TIPOS_AVISO_CONVERSACION as readonly string[]).includes(tipo);
}
