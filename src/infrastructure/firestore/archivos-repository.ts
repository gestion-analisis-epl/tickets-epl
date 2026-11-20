import { collection, doc, onSnapshot, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { RegistroArchivo } from "@/types/archivo";
import type { ArchivosRepository } from "@/domain/archivos/archivos-repository";

// Referencia nueva (id autogenerado) en tickets/{ticketId}/archivos, para agregarla a un writeBatch o transaccion.
export function nuevoRegistroArchivoRef(ticketId: string): DocumentReference {
  return doc(collection(db, "tickets", ticketId, "archivos"));
}

export const firestoreArchivosRepository: ArchivosRepository = {
  subscribe(ticketId, callback, onError) {
    return onSnapshot(
      collection(db, "tickets", ticketId, "archivos"),
      (snap) => callback(snap.docs.map((d) => ({ ...(d.data({ serverTimestamps: "estimate" }) as RegistroArchivo), id: d.id }))),
      onError ? (err) => onError({ code: err.code }) : undefined
    );
  },
};
