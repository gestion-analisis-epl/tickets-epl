import type { Estatus } from "@/types/ticket";

export interface TicketNotifier {
  ticketCreado(info: { ticketId: string; folio: string; mensaje: string }): Promise<void>;
  ticketAsignado(info: { ticketId: string; folio: string; abogadoId: string }): Promise<void>;
  ticketCambioEstatus(info: {
    ticketId: string;
    folio: string;
    solicitanteId: string;
    estatus: Estatus;
    tokenCalificacion?: string;
  }): Promise<void>;
}
