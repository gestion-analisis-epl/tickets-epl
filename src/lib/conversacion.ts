import { auth } from "./firebase";
import { firestoreComentarioRepository } from "@/infrastructure/firestore/comentario-repository";
import { createConversacionService } from "@/domain/tickets/conversacion-service";

export type { Comentario } from "@/types/comentario";

async function postConToken(ruta: string, body: unknown): Promise<Response> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Tu sesion expiro, recarga la pagina.");
  return fetch(ruta, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Best-effort: el servidor calcula los destinatarios y evita avisos repetidos.
async function avisarComentarioCreado(ticketId: string, comentarioId: string): Promise<void> {
  await postConToken(`/api/tickets/${encodeURIComponent(ticketId)}/comentarios/avisar`, { comentarioId });
}

const conversacionService = createConversacionService(firestoreComentarioRepository, { comentarioCreado: avisarComentarioCreado });

export const comentar = conversacionService.comentar;
export const editarComentario = conversacionService.editar;
export const eliminarComentario = conversacionService.eliminar;
export const subscribeComentarios = conversacionService.subscribeComentarios;

// Ruta de servidor (Admin SDK): el jefe de zona no puede escribir el ticket desde el cliente.
export async function solicitarCambios(ticketId: string, texto: string): Promise<void> {
  const res = await postConToken(`/api/tickets/${encodeURIComponent(ticketId)}/pedir-cambios`, { texto });
  if (res.ok) return;
  const data: unknown = await res.json().catch(() => null);
  const mensaje =
    typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : null;
  throw new Error(mensaje ?? "No se pudieron pedir los cambios. Intenta de nuevo.");
}
