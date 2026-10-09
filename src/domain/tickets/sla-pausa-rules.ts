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
  // El historial es append-only, por lo tanto cronologico.
  const historial = ticket.historialEstatus ?? [];
  const fechaDe = (i: number): Date | null => {
    const fecha = historial[i]?.fecha;
    if (!fecha) return null;
    const d = new Date(fecha);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  let total = 0;
  for (let i = 0; i < historial.length; i++) {
    if (historial[i]?.estatus !== ESTATUS_PAUSA_SLA) continue;

    let j = i + 1;
    while (j < historial.length && historial[j]?.estatus === ESTATUS_PAUSA_SLA) j++;

    const inicioPausa = fechaDe(i);
    const finPausa = j < historial.length ? fechaDe(j) : null;
    i = j - 1;
    if (!inicioPausa) continue;

    const fin = finPausa ?? hasta;
    const inicio = inicioPausa < inicioSla ? inicioSla : inicioPausa;
    if (fin > inicio) total += businessDaysBetween(inicio, fin);
  }
  return total;
}

export function diasHabilesSla(ticket: TicketSla, hasta: Date): number {
  if (!ticket.fechaAsignacion) return 0;
  return Math.max(0, businessDaysBetween(new Date(ticket.fechaAsignacion), hasta) - diasHabilesEnPausa(ticket, hasta));
}
