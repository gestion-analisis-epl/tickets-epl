import { businessDaysBetween } from "./business-days";
import type { Ticket } from "@/types/ticket";

// Mientras el ticket sigue abierto, pipeline y SLA se recalculan contra HOY
// en cada lectura (igual que TODAY() en el Excel original); al cerrar quedan
// fijos. Sin fechaAsignacion el SLA no ha arrancado, por eso queda null en
// vez de 0 dias / SLA completo.
export function withLiveDerivedFields(ticket: Ticket): Ticket {
  if (ticket.fechaCierre) return ticket;

  const diasPipeline = businessDaysBetween(new Date(ticket.fechaSolicitud), new Date());

  if (!ticket.fechaAsignacion) {
    return { ...ticket, diasPipeline, diasHabilesTranscurridos: null, nivelServicio: null };
  }

  const dias = businessDaysBetween(new Date(ticket.fechaAsignacion), new Date());
  return { ...ticket, diasPipeline, diasHabilesTranscurridos: dias, nivelServicio: ticket.slaInterno - dias };
}

// Clave y alias del sitio del ticket; los previos al selector traen solo texto libre (va en el alias).
export function partesSitio(ticket: Ticket): { clave: string; alias: string } {
  const sitio = ticket.sitioArrendamiento;
  if (sitio) return { clave: sitio.clave ?? "", alias: sitio.alias ?? "" };
  return { clave: "", alias: ticket.contratoArrendamiento?.sitio ?? "" };
}

// "CLAVE — alias", para busqueda y correos. "" si el ticket no tiene sitio.
export function etiquetaSitio(ticket: Ticket): string {
  const { clave, alias } = partesSitio(ticket);
  return [clave, alias].filter(Boolean).join(" — ");
}
