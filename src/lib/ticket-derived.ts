import { businessDaysBetween } from "./business-days";
import type { Ticket } from "@/types/ticket";

/*
 * Mientras el ticket sigue abierto, "dias habiles transcurridos" y "nivel de
 * servicio" se recalculan contra HOY en cada lectura (igual que la formula
 * de Excel usaba TODAY()). En cuanto se llena fechaCierre, los valores
 * guardados quedan fijos — eso lo hara el flujo de cierre (pendiente).
 */
export function withLiveDerivedFields(ticket: Ticket): Ticket {
  if (ticket.fechaCierre) return ticket;

  const dias = businessDaysBetween(new Date(ticket.fechaSolicitud), new Date());
  return { ...ticket, diasHabilesTranscurridos: dias, nivelServicio: ticket.slaInterno - dias };
}
