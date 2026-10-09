import { collection, doc, onSnapshot, orderBy, query, setDoc, writeBatch, type FirestoreError } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NuevoComentario } from "@/types/comentario";
import type { RepositoryError } from "@/domain/tickets/ticket-repository";
import type { ComentarioRepository } from "@/domain/tickets/comentario-repository";
import { nuevaEntradaHistorialRef } from "./historial-repository";

function toRepositoryError(err: FirestoreError): RepositoryError {
  return { code: err.code };
}

const comentariosDe = (ticketId: string) => collection(db, "tickets", ticketId, "comentarios");

export const firestoreComentarioRepository: ComentarioRepository = {
  async crear(ticketId, comentario) {
    const ref = doc(comentariosDe(ticketId));
    await setDoc(ref, comentario);
    return ref.id;
  },

  async actualizarConHistorial(ticketId, comentarioId, cambio, entrada) {
    const batch = writeBatch(db);
    batch.update(doc(comentariosDe(ticketId), comentarioId), cambio);
    batch.set(nuevaEntradaHistorialRef(ticketId), entrada);
    await batch.commit();
  },

  // Un solo orderBy sobre un campo: indice automatico.
  subscribe(ticketId, callback, onError) {
    return onSnapshot(
      query(comentariosDe(ticketId), orderBy("creadoEn", "asc")),
      (snap) => callback(snap.docs.map((d) => ({ ...(d.data() as NuevoComentario), id: d.id }))),
      onError ? (err) => onError(toRepositoryError(err)) : undefined
    );
  },
};
