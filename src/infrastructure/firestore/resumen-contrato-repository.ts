import { collection, doc, query, where, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, type FirestoreError } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { RepositoryError } from "@/domain/tickets/ticket-repository";
import { nuevaEntradaHistorialRef } from "./historial-repository";
import type { ResumenContratoRepository } from "@/domain/contratos/resumen-contrato-repository";
import { ETAPAS_VISIBLES_JEFE_ZONA } from "@/domain/contratos/contrato-rules";

function toRepositoryError(err: FirestoreError): RepositoryError {
  return { code: err.code };
}

const COLECCION = "resumenesContrato";

export const firestoreResumenContratoRepository: ResumenContratoRepository = {
  async get(ticketId) {
    const snap = await getDoc(doc(db, COLECCION, ticketId));
    return snap.exists() ? (snap.data() as ResumenContrato) : null;
  },

  async upsert(resumen) {
    await setDoc(doc(db, COLECCION, resumen.ticketId), resumen);
  },

  async updateEstatus(ticketId, estatus, actualizadoEn) {
    await updateDoc(doc(db, COLECCION, ticketId), { estatus, actualizadoEn });
  },

  // Sin orderBy (evita un indice compuesto). El filtro por estatus es obligatorio por las reglas.
  subscribeMany(callback, onError) {
    return onSnapshot(
      query(collection(db, COLECCION), where("estatus", "in", [...ETAPAS_VISIBLES_JEFE_ZONA])),
      (snap) => callback(snap.docs.map((d) => d.data() as ResumenContrato)),
      onError ? (err) => onError(toRepositoryError(err)) : undefined
    );
  },

  // Sin filtro de etapa: solo el jefe de zona (ver firestore.rules). Sin orderBy: se ordena en JS.
  subscribeTodos(callback, onError) {
    return onSnapshot(
      collection(db, COLECCION),
      (snap) => callback(snap.docs.map((d) => d.data() as ResumenContrato)),
      onError ? (err) => onError(toRepositoryError(err)) : undefined
    );
  },

  subscribeOne(ticketId, callback, onError) {
    return onSnapshot(
      doc(db, COLECCION, ticketId),
      (snap) => callback(snap.exists() ? (snap.data() as ResumenContrato) : null),
      onError ? (err) => onError(toRepositoryError(err)) : undefined
    );
  },

  // deleteDoc no falla si el documento no existe.
  async delete(ticketId) {
    await deleteDoc(doc(db, COLECCION, ticketId));
  },

  async registrarVistoBueno(ticketId, visto, entrada) {
    const batch = writeBatch(db);
    batch.update(doc(db, COLECCION, ticketId), { vistoBueno: visto });
    batch.set(nuevaEntradaHistorialRef(ticketId), entrada);
    await batch.commit();
  },
};
