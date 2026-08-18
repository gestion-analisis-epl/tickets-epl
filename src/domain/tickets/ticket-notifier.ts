import type { Estatus } from "@/types/ticket";

export interface TicketNotifier {
  ticketCreado(info: { ticketId: string; folio: string; mensaje: string; solicitanteId: string }): Promise<void>;
  ticketAsignado(info: { ticketId: string; folio: string; abogadoId: string; solicitanteId: string }): Promise<void>;
  ticketCambioEstatus(info: {
    ticketId: string;
    folio: string;
    solicitanteId: string;
    estatus: Estatus;
    tokenCalificacion?: string;
  }): Promise<void>;
}
