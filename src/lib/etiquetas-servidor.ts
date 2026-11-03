import { getAdminDb } from "@/lib/firebase-admin";
import { sinUndefined } from "@/lib/storage-ruta";
import { construirResumenContrato } from "@/domain/contratos/contrato-rules";
import type { EtiquetaDocumento, Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";

export async function cargarTicketServidor(id: string): Promise<Ticket | null> {
  const snap = await getAdminDb().collection("tickets").doc(id).get();
  return snap.exists ? ({ ...snap.data(), id: snap.id } as Ticket) : null;
}

// Guarda las etiquetas en el ticket y, si el ticket ya tiene resumen (Pre-Cierre/Cierre), lo refresca: es lo unico
// que ven Jefe de Zona y Sitios, y ahi los adjuntos salen con la etiqueta.
export async function guardarEtiquetasServidor(ticketId: string, etiquetas: EtiquetaDocumento[]): Promise<void> {
  const db = getAdminDb();
  const ticketRef = db.collection("tickets").doc(ticketId);
  await ticketRef.update({ etiquetasDocumentos: sinUndefined(etiquetas) });

  const resumenRef = db.collection("resumenesContrato").doc(ticketId);
  const previo = await resumenRef.get();
  if (!previo.exists) return;
  const ticket = { ...(await ticketRef.get()).data(), id: ticketId } as Ticket;
  await resumenRef.set(sinUndefined(construirResumenContrato(ticket, new Date(), previo.data() as ResumenContrato)));
}
