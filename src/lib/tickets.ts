import {
  collection, doc, runTransaction, query, where, onSnapshot, getDoc, getDocs, updateDoc, deleteDoc,
  type Unsubscribe, type FirestoreError,
} from "firebase/firestore";
import { db } from "./firebase";
import { deleteTicketDocuments } from "./storage";
import { findServicio } from "./data/catalogo-servicios";
import { addBusinessDays, businessDaysBetween } from "./business-days";
import type { Ticket, Estatus, HistorialEntry } from "@/types/ticket";
import type { Role } from "@/types/user";

export interface NuevoTicketInput {
  solicitanteId: string;
  solicitanteNombre: string;
  areaEmpresa: string;
  servicioId: string;
  descripcion: string;
  documentacion: string[];
}

// folio (JUR-0001...) es solo una etiqueta legible; el id de Firestore es el
// identificador real. Ambos se crean en la misma transaccion del contador
// para que nunca quede un folio "gastado" sin ticket detras.
export async function createTicket(input: NuevoTicketInput): Promise<{ id: string; folio: string }> {
  const servicio = findServicio(input.servicioId);
  if (!servicio) throw new Error("Servicio no encontrado en el catalogo.");

  const counterRef = doc(db, "meta", "ticketCounter");
  const ref = doc(collection(db, "tickets"));

  return runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const next = counterSnap.exists() ? (counterSnap.data().next as number) : 1;
    const folio = `JUR-${String(next).padStart(4, "0")}`;

    const fechaSolicitud = new Date().toISOString();

    const ticket: Ticket = {
      id: ref.id,
      folio,
      fechaSolicitud,
      solicitanteId: input.solicitanteId,
      solicitanteNombre: input.solicitanteNombre,
      areaEmpresa: input.areaEmpresa,
      servicioId: input.servicioId,
      descripcion: input.descripcion,
      documentacion: input.documentacion,
      categoria: servicio.categoria,
      puestoResponsableSugerido: servicio.puestoResponsable,
      slaInterno: servicio.slaInterno,
      // El SLA arranca al asignar abogado, no aqui (ver updateTicketAsignacion).
      fechaCompromiso: null,
      diasHabilesTranscurridos: null,
      nivelServicio: null,
      diasPipeline: null,
      estatus: "Recepcion de solicitud",
      abogadoAsignadoId: null,
      fechaAsignacion: null,
      fechaCierre: null,
      notasCierre: null,
      historialEstatus: [{ estatus: "Recepcion de solicitud", fecha: fechaSolicitud, uid: input.solicitanteId }],
    };

    tx.set(counterRef, { next: next + 1 }, { merge: true });
    tx.set(ref, ticket);

    return { id: ref.id, folio };
  });
}

// Solicitantes solo ven los suyos; Legal/admin ven todos. Sin orderBy (evita
// un indice compuesto) — se ordena en JS, el volumen de tickets lo permite.
export function subscribeTickets(
  { uid, role }: { uid: string; role: Role },
  callback: (tickets: Ticket[]) => void
): Unsubscribe {
  const ticketsRef = collection(db, "tickets");
  const q = role === "solicitante" ? query(ticketsRef, where("solicitanteId", "==", uid)) : query(ticketsRef);

  return onSnapshot(q, (snap) => {
    // id siempre desde snap.id, no del campo "id" guardado — tickets viejos
    // no lo tenian y eso rompia rutas /tickets/undefined.
    const tickets = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Ticket);
    tickets.sort((a, b) => (a.fechaSolicitud < b.fechaSolicitud ? 1 : -1));
    callback(tickets);
  });
}

export function subscribeTicket(
  id: string,
  callback: (ticket: Ticket | null) => void,
  onError?: (err: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "tickets", id),
    (snap) => callback(snap.exists() ? ({ ...snap.data(), id: snap.id } as Ticket) : null),
    onError
  );
}

export interface AsignacionInput {
  estatus: Estatus;
  abogadoAsignadoId: string | null;
  notasCierre: string | null;
}

// El SLA (fechaCompromiso, diasHabilesTranscurridos, nivelServicio) arranca
// en fechaAsignacion, no en fechaSolicitud; diasPipeline cuenta
// fechaSolicitud→cierre aparte. Ambos se congelan al cerrar (ver
// lib/ticket-derived.ts).
export async function updateTicketAsignacion(id: string, actorUid: string, input: AsignacionInput): Promise<void> {
  const ref = doc(db, "tickets", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Ticket no encontrado.");
  const current = snap.data() as Ticket;

  const patch: Partial<Ticket> = {
    estatus: input.estatus,
    abogadoAsignadoId: input.abogadoAsignadoId,
    notasCierre: input.notasCierre,
  };

  if (input.abogadoAsignadoId && !current.fechaAsignacion) {
    const fechaAsignacion = new Date().toISOString();
    patch.fechaAsignacion = fechaAsignacion;
    patch.fechaCompromiso = addBusinessDays(new Date(fechaAsignacion), current.slaInterno).toISOString();
  }

  if (input.estatus === "Cierre" && !current.fechaCierre) {
    // Si se asigna y cierra en la misma accion, usar la fecha recien fijada.
    const fechaAsignacionEfectiva = patch.fechaAsignacion ?? current.fechaAsignacion;

    patch.fechaCierre = new Date().toISOString();
    patch.diasPipeline = businessDaysBetween(new Date(current.fechaSolicitud), new Date());

    if (fechaAsignacionEfectiva) {
      const dias = businessDaysBetween(new Date(fechaAsignacionEfectiva), new Date());
      patch.diasHabilesTranscurridos = dias;
      patch.nivelServicio = current.slaInterno - dias;
    }
  }

  const historialEntry: HistorialEntry = { estatus: input.estatus, fecha: new Date().toISOString(), uid: actorUid };
  const historialEstatus =
    input.estatus !== current.estatus ? [...current.historialEstatus, historialEntry] : current.historialEstatus;

  await updateDoc(ref, { ...patch, historialEstatus });
}

export interface SolicitudInput {
  areaEmpresa: string;
  servicioId: string;
  descripcion: string;
  documentacion: string[];
}

// Corrige los campos verdes propios mientras el ticket no este en Cierre (ver
// firestore.rules). fechaCompromiso solo existe una vez asignado el abogado.
export async function updateTicketSolicitud(id: string, input: SolicitudInput): Promise<void> {
  const servicio = findServicio(input.servicioId);
  if (!servicio) throw new Error("Servicio no encontrado en el catalogo.");

  const ref = doc(db, "tickets", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Ticket no encontrado.");
  const current = snap.data() as Ticket;

  const fechaCompromiso = current.fechaAsignacion
    ? addBusinessDays(new Date(current.fechaAsignacion), servicio.slaInterno).toISOString()
    : null;

  await updateDoc(ref, {
    areaEmpresa: input.areaEmpresa,
    servicioId: input.servicioId,
    descripcion: input.descripcion,
    documentacion: input.documentacion,
    categoria: servicio.categoria,
    puestoResponsableSugerido: servicio.puestoResponsable,
    slaInterno: servicio.slaInterno,
    fechaCompromiso,
  });
}

// Solo admin (ver firestore.rules). Borra primero los archivos en Storage y
// despues el documento.
export async function deleteTicket(id: string): Promise<void> {
  const ref = doc(db, "tickets", id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteTicketDocuments((snap.data() as Ticket).documentacion);
  }
  await deleteDoc(ref);
}

// Unica escritura que el solicitante puede hacer sobre un ticket ya cerrado
// (ver firestore.rules).
export async function submitSatisfaccion(id: string, satisfaccion: number): Promise<void> {
  await updateDoc(doc(db, "tickets", id), { satisfaccion });
}

export interface BackfillResultado {
  actualizados: number;
  omitidos: number;
  detalles: string[];
}

// Backfill de un solo uso (boton en Configuracion → Mantenimiento) para
// tickets cerrados antes del cambio de SLA a fechaAsignacion — los abiertos
// se recalculan solos en cada lectura (ver ticket-derived.ts).
export async function backfillSlaHistorico(): Promise<BackfillResultado> {
  const snap = await getDocs(query(collection(db, "tickets"), where("estatus", "==", "Cierre")));
  const detalles: string[] = [];
  let actualizados = 0;
  let omitidos = 0;

  for (const docSnap of snap.docs) {
    const t = docSnap.data() as Ticket;

    if (!t.fechaSolicitud || !t.fechaCierre) {
      detalles.push(`[omitido] ${t.folio ?? docSnap.id}: sin fechaSolicitud/fechaCierre.`);
      omitidos++;
      continue;
    }

    const diasPipeline = businessDaysBetween(new Date(t.fechaSolicitud), new Date(t.fechaCierre));
    const patch: Partial<Ticket> = { diasPipeline };

    if (t.fechaAsignacion) {
      const dias = businessDaysBetween(new Date(t.fechaAsignacion), new Date(t.fechaCierre));
      patch.diasHabilesTranscurridos = dias;
      patch.nivelServicio = t.slaInterno - dias;
    } else {
      // Nunca se asigno abogado: el SLA no llego a arrancar.
      patch.diasHabilesTranscurridos = null;
      patch.nivelServicio = null;
    }

    await updateDoc(docSnap.ref, patch);
    actualizados++;
    detalles.push(
      `[ok] ${t.folio ?? docSnap.id}: diasPipeline=${diasPipeline}, nivelServicio=${patch.nivelServicio ?? "null (nunca se asigno)"}`
    );
  }

  return { actualizados, omitidos, detalles };
}
