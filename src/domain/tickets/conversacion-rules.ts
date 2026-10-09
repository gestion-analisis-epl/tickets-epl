import type { Estatus, Ticket } from "@/types/ticket";
import { isAdminRole, type Role } from "@/types/user";
import type { NuevoComentario } from "@/types/comentario";

// Sincronizar con textoComentarioValido() en firestore.rules.
export const MAX_TEXTO_COMENTARIO = 4000;

export type ResultadoTexto = { ok: true; texto: string } | { ok: false; error: string };

export function validarTextoComentario(texto: string): ResultadoTexto {
  const limpio = texto.trim();
  if (!limpio) return { ok: false, error: "Escribe un comentario." };
  if (limpio.length > MAX_TEXTO_COMENTARIO) {
    return { ok: false, error: `El comentario no puede pasar de ${MAX_TEXTO_COMENTARIO} caracteres.` };
  }
  return { ok: true, texto: limpio };
}

type EstadoHilo = Pick<Ticket, "estatus" | "conversacionAbiertaEn">;

// Primera entrada a Pre-Cierre; los tickets que ya estaban ahi al desplegar la abren al salir.
export function debeAbrirConversacion(current: EstadoHilo, nuevoEstatus: Estatus): boolean {
  return !current.conversacionAbiertaEn && (nuevoEstatus === "Pre-Cierre" || current.estatus === "Pre-Cierre");
}

export function hiloVisible(ticket: EstadoHilo): boolean {
  return !!ticket.conversacionAbiertaEn || ticket.estatus === "Pre-Cierre";
}

// Sincronizar con hiloEscribible() en firestore.rules.
export function hiloEscribible(ticket: EstadoHilo): boolean {
  return ticket.estatus !== "Cierre" && hiloVisible(ticket);
}

// Sincronizar con esParticipante() en firestore.rules. El jefe de zona, ademas, solo si existe el resumen
// del ticket (ya entro a Pre-Cierre), en cualquier etapa; eso lo exigen las reglas y en pantalla solo
// llega por /pre-cierre.
export function esParticipante(
  sesion: { uid: string | null; role: Role; abogadoId: string | null },
  ticket: Pick<Ticket, "solicitanteId" | "abogadoAsignadoId">
): boolean {
  if (!sesion.uid) return false;
  if (isAdminRole(sesion.role) || sesion.role === "jefe_zona") return true;
  if (ticket.solicitanteId === sesion.uid) return true;
  return !!sesion.abogadoId && sesion.abogadoId === ticket.abogadoAsignadoId;
}

// Solo el autor, y solo comentarios normales vivos ("cambios_solicitados" no se edita: lo creo el servidor).
export function puedeEditarComentario(
  uid: string | null,
  comentario: Pick<NuevoComentario, "autorUid" | "eliminado" | "tipo">
): boolean {
  return !!uid && comentario.autorUid === uid && !comentario.eliminado && comentario.tipo === "comentario";
}
