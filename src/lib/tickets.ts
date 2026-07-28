import {
  collection, doc, runTransaction, query, where, onSnapshot, getDoc, updateDoc, deleteDoc,
  type Unsubscribe, type FirestoreError,
} from "firebase/firestore";
import { db } from "./firebase";
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

/*
 * El ID del documento (usado para rutas y todo lookup tecnico) es autogenerado
 * por Firestore — estable e inmutable, igual espiritu que un uid de Firebase
 * Auth. El folio (JUR-0001...) es SOLO una etiqueta legible para humanos,
 * guardada como campo normal; nunca se usa para identificar el ticket. Ambos
 * se crean en la MISMA transaccion que incrementa el contador, asi que nunca
 * queda un folio "gastado" sin ticket detras.
 */
export async function createTicket(input: NuevoTicketInput): Promise<{ id: string; folio: string }> {
  const servicio = findServicio(input.servicioId);
  if (!servicio) throw new Error("Servicio no encontrado en el catalogo.");

  const counterRef = doc(db, "meta", "ticketCounter");
  const ref = doc(collection(db, "tickets")); // ID aleatorio, generado en el cliente

  return runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const next = counterSnap.exists() ? (counterSnap.data().next as number) : 1;
    const folio = `JUR-${String(next).padStart(4, "0")}`;

    const fechaSolicitud = new Date().toISOString();
    const fechaCompromiso = addBusinessDays(new Date(), servicio.slaInterno).toISOString();

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
      fechaCompromiso,
      // Se calculan en vivo mientras el ticket sigue abierto (ver
      // lib/ticket-derived.ts); se congelan solo al llenar fechaCierre.
      diasHabilesTranscurridos: null,
      nivelServicio: null,
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

/*
 * Solicitantes solo ven los suyos; Legal/admin ven todos. El filtro por uid
 * no lleva orderBy (evita necesitar un indice compuesto) — se ordena en JS
 * en el callback, con volumenes de tickets esto es de sobra suficiente.
 */
export function subscribeTickets(
  { uid, role }: { uid: string; role: Role },
  callback: (tickets: Ticket[]) => void
): Unsubscribe {
  const ticketsRef = collection(db, "tickets");
  const q = role === "solicitante" ? query(ticketsRef, where("solicitanteId", "==", uid)) : query(ticketsRef);

  return onSnapshot(q, (snap) => {
    // El id SIEMPRE se toma de la clave real del documento (snap.id), nunca
    // del campo "id" guardado — los tickets creados antes de separar id/folio
    // no tienen ese campo en Firestore, y confiar en el campo daba
    // "undefined" para esos (de ahi rutas rotas tipo /tickets/undefined).
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

/*
 * Lo usa Mesa de Control / abogado / admin desde el detalle del ticket.
 * Fecha de asignacion y fecha de cierre se autocompletan la primera vez que
 * corresponde (no se piden a mano, igual que fechaSolicitud en la creacion).
 * Al cerrar, "dias transcurridos" y "nivel de servicio" se congelan (dejan de
 * recalcularse en vivo, ver lib/ticket-derived.ts).
 */
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
    patch.fechaAsignacion = new Date().toISOString();
  }

  if (input.estatus === "Cierre" && !current.fechaCierre) {
    const dias = businessDaysBetween(new Date(current.fechaSolicitud), new Date());
    patch.fechaCierre = new Date().toISOString();
    patch.diasHabilesTranscurridos = dias;
    patch.nivelServicio = current.slaInterno - dias;
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

/*
 * Lo usa el solicitante dueno para corregir su propia solicitud (campos
 * verdes) — solo mientras el ticket no este en Cierre (ver firestore.rules,
 * misma restriccion). Si cambia el servicio, los campos "gris" derivados
 * (categoria, puesto responsable, SLA, fecha compromiso) se recalculan —
 * la fecha compromiso se ancla a la fechaSolicitud ORIGINAL, no a hoy.
 */
export async function updateTicketSolicitud(id: string, input: SolicitudInput): Promise<void> {
  const servicio = findServicio(input.servicioId);
  if (!servicio) throw new Error("Servicio no encontrado en el catalogo.");

  const ref = doc(db, "tickets", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Ticket no encontrado.");
  const current = snap.data() as Ticket;

  const fechaCompromiso = addBusinessDays(new Date(current.fechaSolicitud), servicio.slaInterno).toISOString();

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

// Solo admin (ver firestore.rules) — accion destructiva y permanente, no
// borra los archivos ya subidos a Storage (queda pendiente de limpieza).
export async function deleteTicket(id: string): Promise<void> {
  await deleteDoc(doc(db, "tickets", id));
}

// Lo usa el solicitante dueno del ticket, solo cuando ya esta en Cierre
// (ver firestore.rules — es la unica escritura que puede hacer sobre un
// ticket ya creado, y solo toca este campo).
export async function submitSatisfaccion(id: string, satisfaccion: number): Promise<void> {
  await updateDoc(doc(db, "tickets", id), { satisfaccion });
}
