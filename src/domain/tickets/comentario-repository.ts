import type { Comentario, NuevoComentario } from "@/types/comentario";
import type { EntradaHistorial } from "@/types/historial";
import type { RepositoryError, Unsubscribe } from "./ticket-repository";

export type CambioComentario = Partial<Pick<Comentario, "texto" | "editadoEn" | "eliminado">>;

export interface ComentarioRepository {
  // Devuelve el id del comentario creado.
  crear(ticketId: string, comentario: NuevoComentario): Promise<string>;
  // Comentario y su entrada de historial en un solo lote (las reglas exigen ambos juntos).
  actualizarConHistorial(ticketId: string, comentarioId: string, cambio: CambioComentario, entrada: EntradaHistorial): Promise<void>;
  // Orden cronologico ascendente (un solo orderBy: no requiere indice compuesto).
  subscribe(ticketId: string, callback: (comentarios: Comentario[]) => void, onError?: (e: RepositoryError) => void): Unsubscribe;
}

// Best-effort: el servidor calcula destinatarios y evita avisos repetidos.
export interface AvisosConversacion {
  comentarioCreado(ticketId: string, comentarioId: string): Promise<void>;
}
