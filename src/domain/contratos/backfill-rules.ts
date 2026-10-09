import type { Ticket } from "@/types/ticket";
import { encontrarContrato, nombreDeUrl, resumenReintentable } from "./contrato-rules";

type TicketConDocs = Pick<Ticket, "documentacion" | "resumenContrato">;

export function esDocx(url: string): boolean {
  return nombreDeUrl(url).toLowerCase().endsWith(".docx");
}

export function docxsDeDocumentacion(documentacion: string[]): string[] {
  return documentacion.filter(esDocx);
}

// Valor inicial del selector: el contrato ya usado, o el detectado por nombre, o el primer docx.
export function archivoPorDefecto(ticket: TicketConDocs): string {
  const docxs = docxsDeDocumentacion(ticket.documentacion);
  const usado = ticket.resumenContrato?.contratoUrl;
  if (usado && docxs.includes(usado)) return usado;
  return encontrarContrato(ticket.documentacion) ?? docxs[0] ?? "";
}

// Sin resumen, con error o con un "pendiente" atascado.
export function ticketsPendientesDeResumen<T extends TicketConDocs>(tickets: T[], ahora: Date = new Date()): T[] {
  return tickets.filter((t) => resumenReintentable(t.resumenContrato, ahora) && encontrarContrato(t.documentacion) !== null);
}
