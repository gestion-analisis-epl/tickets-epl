import type { Estatus } from "@/types/ticket";

// Puerto para los avisos disparados por cambios de ticket (notificacion +
// correo). El dominio no necesita saber que hoy eso implica leer/escribir
// Firestore y llamar a un endpoint propio.
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
