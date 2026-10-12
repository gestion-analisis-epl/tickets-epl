import type { Ticket } from "@/types/ticket";
import { encontrarContrato, ETAPAS_VISIBLES_JEFE_ZONA, nombreDeUrl, resumenReintentable } from "./contrato-rules";
import { esArchivoContrato } from "./tipo-archivo";

type TicketConDocs = Pick<Ticket, "documentacion" | "resumenContrato">;

export function archivosContratoDeDocumentacion(documentacion: string[]): string[] {
  return documentacion.filter((url) => esArchivoContrato(nombreDeUrl(url)));
}

// Valor inicial del selector: el contrato ya usado, o el detectado por nombre, o el primer docx/pdf.
export function archivoPorDefecto(ticket: TicketConDocs): string {
  const archivos = archivosContratoDeDocumentacion(ticket.documentacion);
  const usado = ticket.resumenContrato?.contratoUrl;
  if (usado && archivos.includes(usado)) return usado;
  return encontrarContrato(ticket.documentacion) ?? archivos[0] ?? "";
}

// Fecha en que el ticket entro a Pre-Cierre por primera vez (null si nunca estuvo ahi).
export function primeraEntradaPreCierre(ticket: Pick<Ticket, "historialEstatus">): string | null {
  const entradas = (ticket.historialEstatus ?? []).filter((h) => h.estatus === "Pre-Cierre").map((h) => h.fecha).sort();
  return entradas[0] ?? null;
}

// Tickets que estan o estuvieron en Pre-Cierre/Cierre: deben tener su documento de resumen
// (los que regresaron a una etapa anterior aparecen "en correccion" para el jefe de zona).
export function ticketLlegoAPreCierreOCierre(ticket: Pick<Ticket, "estatus" | "historialEstatus">): boolean {
  return (
    ETAPAS_VISIBLES_JEFE_ZONA.includes(ticket.estatus) ||
    (ticket.historialEstatus ?? []).some((h) => ETAPAS_VISIBLES_JEFE_ZONA.includes(h.estatus))
  );
}

// Sin resumen, con error o con un "pendiente" atascado.
export function ticketsPendientesDeResumen<T extends TicketConDocs>(tickets: T[], ahora: Date = new Date()): T[] {
  return tickets.filter((t) => resumenReintentable(t.resumenContrato, ahora) && encontrarContrato(t.documentacion) !== null);
}
