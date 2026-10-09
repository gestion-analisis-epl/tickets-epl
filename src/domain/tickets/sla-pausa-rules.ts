import { businessDaysBetween } from "@/lib/business-days";
import type { Ticket } from "@/types/ticket";

// En Pre-Cierre el ticket espera al jefe de zona: sale del alcance del abogado y su SLA se pausa.
export const ESTATUS_PAUSA_SLA = "Pre-Cierre";

type TicketSla = Pick<Ticket, "historialEstatus" | "fechaAsignacion">;

export function slaEnPausa(ticket: Pick<Ticket, "estatus">): boolean {
  return ticket.estatus === ESTATUS_PAUSA_SLA;
}

// Dias habiles en Pre-Cierre desde la fechaAsignacion vigente hasta `hasta`, derivados del historial.
export function diasHabilesEnPausa(ticket: TicketSla, hasta: Date): number {
  if (!ticket.fechaAsignacion) return 0;
  const inicioSla = new Date(ticket.fechaAsignacion);
  const historial = ticket.historialEstatus;

  let total = 0;
  for (let i = 0; i < historial.length; i++) {
    if (historial[i].estatus !== ESTATUS_PAUSA_SLA) continue;

    let j = i + 1;
    while (j < historial.length && historial[j].estatus === ESTATUS_PAUSA_SLA) j++;

    const fin = j < historial.length ? new Date(historial[j].fecha) : hasta;
    const inicioPausa = new Date(historial[i].fecha);
    const inicio = inicioPausa < inicioSla ? inicioSla : inicioPausa;
    if (fin > inicio) total += businessDaysBetween(inicio, fin);
    i = j - 1;
  }
  return total;
}

export function diasHabilesSla(ticket: TicketSla, hasta: Date): number {
  if (!ticket.fechaAsignacion) return 0;
  return Math.max(0, businessDaysBetween(new Date(ticket.fechaAsignacion), hasta) - diasHabilesEnPausa(ticket, hasta));
}
