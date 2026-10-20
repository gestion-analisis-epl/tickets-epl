import { collection, doc, onSnapshot, orderBy, query, where, type DocumentReference, type FirestoreError } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EntradaHistorial } from "@/types/historial";
import type { RepositoryError } from "@/domain/tickets/ticket-repository";
import type { HistorialRepository } from "@/domain/tickets/historial-repository";

function toRepositoryError(err: FirestoreError): RepositoryError {
  return { code: err.code };
}

// Referencia nueva (id autogenerado) en tickets/{ticketId}/historial, para agregarla a un writeBatch.
export function nuevaEntradaHistorialRef(ticketId: string): DocumentReference {
  return doc(collection(db, "tickets", ticketId, "historial"));
}

export const firestoreHistorialRepository: HistorialRepository = {
  // Un solo orderBy sobre un campo: usa el indice automatico, no requiere indice compuesto.
  // Con el filtro del solicitante no se ordena aqui (evita un indice compuesto): lineaDeTiempo ordena en JS.
  subscribe(ticketId, callback, onError, opciones) {
    const entradas = collection(db, "tickets", ticketId, "historial");
    const consulta = opciones?.soloVisibleSolicitante
      ? query(entradas, where("visibleSolicitante", "==", true))
      : query(entradas, orderBy("fecha", "desc"));
    return onSnapshot(
      consulta,
      (snap) => callback(snap.docs.map((d) => ({ ...(d.data() as EntradaHistorial), id: d.id }))),
      onError ? (err) => onError(toRepositoryError(err)) : undefined
    );
  },
};
