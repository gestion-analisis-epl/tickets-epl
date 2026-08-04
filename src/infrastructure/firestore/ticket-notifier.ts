import { crearNotificacion, notificarAsignacion, enviarEmailPrueba } from "@/lib/notificaciones";
import type { TicketNotifier } from "@/domain/tickets/ticket-notifier";

export const firestoreTicketNotifier: TicketNotifier = {
  async ticketCreado({ ticketId, folio, mensaje }) {
    await enviarEmailPrueba({ tipo: "nuevo_ticket", mensaje, ticketId, ticketFolio: folio });
  },

  async ticketAsignado({ ticketId, folio, abogadoId }) {
    const mensaje = `Te asignaron el ticket ${folio}.`;
    await Promise.all([
      notificarAsignacion(ticketId, folio, abogadoId),
      enviarEmailPrueba({ tipo: "asignacion", mensaje, ticketId, ticketFolio: folio }),
    ]);
  },

  async ticketCambioEstatus({ ticketId, folio, solicitanteId, estatus, tokenCalificacion }) {
    const tipo = estatus === "Cierre" ? "cierre" : "cambio_estatus";
    const mensaje = estatus === "Cierre" ? `Tu ticket ${folio} fue cerrado.` : `Tu ticket ${folio} cambio de estatus: ${estatus}.`;

    await Promise.all([
      crearNotificacion({ ticketId, ticketFolio: folio, tipo, mensaje, paraUid: solicitanteId, paraRoles: null }),
      enviarEmailPrueba({ tipo, mensaje, ticketId, ticketFolio: folio, tokenCalificacion: tipo === "cierre" ? tokenCalificacion : undefined }),
    ]);
  },
};
