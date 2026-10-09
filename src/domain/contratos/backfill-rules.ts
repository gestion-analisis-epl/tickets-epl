import type { Ticket } from "@/types/ticket";
import { encontrarContrato, nombreDeUrl, resumenReintentable } from "./contrato-rules";
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

// Sin resumen, con error o con un "pendiente" atascado.
export function ticketsPendientesDeResumen<T extends TicketConDocs>(tickets: T[], ahora: Date = new Date()): T[] {
  return tickets.filter((t) => resumenReintentable(t.resumenContrato, ahora) && encontrarContrato(t.documentacion) !== null);
}
