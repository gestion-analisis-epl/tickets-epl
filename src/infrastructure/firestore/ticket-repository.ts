import {
  collection, doc, runTransaction, query, where, onSnapshot, getDoc, getDocs, updateDoc, deleteDoc,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LEGAL_STAFF_ROLES } from "@/types/user";
import type { Ticket } from "@/types/ticket";
import type { TicketRepository, RepositoryError } from "@/domain/tickets/ticket-repository";

function toRepositoryError(err: FirestoreError): RepositoryError {
  return { code: err.code };
}

export const firestoreTicketRepository: TicketRepository = {
  // El folio (JUR-0001...) y el ticket se crean en la misma transaccion del
  // contador para que nunca quede un folio "gastado" sin ticket detras; la
  // notificacion de "nuevo_ticket" entra a la misma escritura por lo mismo.
  async create(build) {
    const counterRef = doc(db, "meta", "ticketCounter");
    const ref = doc(collection(db, "tickets"));

    return runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const next = counterSnap.exists() ? (counterSnap.data().next as number) : 1;
      const folio = `JUR-${String(next).padStart(4, "0")}`;

      const { ticket, notificacionMensaje } = build({ id: ref.id, folio });

      tx.set(counterRef, { next: next + 1 }, { merge: true });
      tx.set(ref, ticket);
      tx.set(doc(collection(db, "notificaciones")), {
        ticketId: ref.id,
        ticketFolio: folio,
        tipo: "nuevo_ticket",
        mensaje: notificacionMensaje,
        fecha: ticket.fechaSolicitud,
        paraUid: null,
        paraRoles: LEGAL_STAFF_ROLES,
        leidoPor: [],
      });

      return { id: ref.id, folio };
    });
  },

  async getById(id) {
    const snap = await getDoc(doc(db, "tickets", id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as Ticket) : null;
  },

  async update(id, patch) {
    await updateDoc(doc(db, "tickets", id), patch);
  },

  async delete(id) {
    await deleteDoc(doc(db, "tickets", id));
  },

  async listCerrados() {
    const snap = await getDocs(query(collection(db, "tickets"), where("estatus", "==", "Cierre")));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Ticket);
  },

  // Solicitantes solo ven los suyos; Legal/admin ven todos. Sin orderBy (evita
  // un indice compuesto) — se ordena en JS, el volumen de tickets lo permite.
  subscribeMany({ uid, role }, callback) {
    const ticketsRef = collection(db, "tickets");
    const q = role === "solicitante" ? query(ticketsRef, where("solicitanteId", "==", uid)) : query(ticketsRef);

    return onSnapshot(q, (snap) => {
      const tickets = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Ticket);
      tickets.sort((a, b) => (a.fechaSolicitud < b.fechaSolicitud ? 1 : -1));
      callback(tickets);
    });
  },

  subscribeOne(id, callback, onError) {
    return onSnapshot(
      doc(db, "tickets", id),
      (snap) => callback(snap.exists() ? ({ ...snap.data(), id: snap.id } as Ticket) : null),
      onError ? (err) => onError(toRepositoryError(err)) : undefined
    );
  },
};
