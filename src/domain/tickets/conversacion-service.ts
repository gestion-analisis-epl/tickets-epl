import type { Comentario } from "@/types/comentario";
import type { ActorHistorial } from "@/types/historial";
import type { AvisosConversacion, ComentarioRepository } from "./comentario-repository";
import { puedeEditarComentario, validarTextoComentario } from "./conversacion-rules";
import { entradaComentarioEditado, entradaComentarioEliminado } from "./historial-rules";

export class ComentarioInvalidoError extends Error {}

// Si el hilo esta habilitado lo deciden las reglas de Firestore (el jefe de zona no lee el ticket).
export function createConversacionService(
  repo: ComentarioRepository,
  avisos: AvisosConversacion,
  ahora: () => Date = () => new Date()
) {
  async function comentar(ticketId: string, autor: ActorHistorial, texto: string): Promise<void> {
    const validado = validarTextoComentario(texto);
    if (!validado.ok) throw new ComentarioInvalidoError(validado.error);

    const id = await repo.crear(ticketId, {
      autorUid: autor.uid,
      autorNombre: autor.nombre,
      autorRol: autor.rol,
      texto: validado.texto,
      tipo: "comentario",
      creadoEn: ahora().toISOString(),
      eliminado: false,
    });
    await avisos.comentarioCreado(ticketId, id).catch(() => {});
  }

  async function editar(ticketId: string, actor: ActorHistorial, comentario: Comentario, texto: string): Promise<void> {
    if (!puedeEditarComentario(actor.uid, comentario)) throw new ComentarioInvalidoError("Solo puedes editar tus comentarios.");
    const validado = validarTextoComentario(texto);
    if (!validado.ok) throw new ComentarioInvalidoError(validado.error);
    if (validado.texto === comentario.texto) return;

    const momento = ahora();
    await repo.actualizarConHistorial(
      ticketId,
      comentario.id,
      { texto: validado.texto, editadoEn: momento.toISOString() },
      entradaComentarioEditado(actor, momento, comentario.id, comentario.texto, validado.texto)
    );
  }

  async function eliminar(ticketId: string, actor: ActorHistorial, comentario: Comentario): Promise<void> {
    if (!puedeEditarComentario(actor.uid, comentario)) throw new ComentarioInvalidoError("Solo puedes eliminar tus comentarios.");

    const momento = ahora();
    await repo.actualizarConHistorial(
      ticketId,
      comentario.id,
      { texto: null, eliminado: true },
      entradaComentarioEliminado(actor, momento, comentario.id, comentario.texto)
    );
  }

  const subscribeComentarios: ComentarioRepository["subscribe"] = (ticketId, callback, onError) =>
    repo.subscribe(ticketId, callback, onError);

  return { comentar, editar, eliminar, subscribeComentarios };
}
