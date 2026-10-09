import type { Ticket } from "@/types/ticket";
import { encontrarContrato, nombreDeUrl } from "./contrato-rules";

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

export function ticketsPendientesDeResumen<T extends TicketConDocs>(tickets: T[]): T[] {
  return tickets.filter((t) => !t.resumenContrato && encontrarContrato(t.documentacion) !== null);
}
