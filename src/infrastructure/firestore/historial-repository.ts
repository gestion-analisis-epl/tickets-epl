import { collection, doc, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Referencia nueva (id autogenerado) en tickets/{ticketId}/historial, para agregarla a un writeBatch.
export function nuevaEntradaHistorialRef(ticketId: string): DocumentReference {
  return doc(collection(db, "tickets", ticketId, "historial"));
}
