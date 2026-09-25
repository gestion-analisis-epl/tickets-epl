import { crearNotificacion, notificarAsignacion, notificarReasignacion, enviarEmailNotificacion } from "@/lib/notificaciones";
import type { TicketNotifier } from "@/domain/tickets/ticket-notifier";

export const firestoreTicketNotifier: TicketNotifier = {
  async ticketCreado({ ticketId, folio, mensaje, solicitanteId }) {
    const mensajeSolicitante = `Tu ticket ${folio} fue creado y esta en revision.`;
    await Promise.all([
      enviarEmailNotificacion({ tipo: "nuevo_ticket", mensaje, ticketId, ticketFolio: folio }),
      crearNotificacion({
        ticketId, ticketFolio: folio, tipo: "creacion_solicitante", mensaje: mensajeSolicitante,
        paraUid: solicitanteId, paraRoles: null,
      }),
      enviarEmailNotificacion({ tipo: "creacion_solicitante", mensaje: mensajeSolicitante, ticketId, ticketFolio: folio }),
    ]);
  },

  async ticketAsignado({ ticketId, folio, abogadoId, solicitanteId }) {
    const mensajeSolicitante = `Se asigno un responsable a tu ticket ${folio}.`;
    await Promise.all([
      notificarAsignacion(ticketId, folio, abogadoId),
      enviarEmailNotificacion({ tipo: "asignacion", mensaje: `Te asignaron el ticket ${folio}.`, ticketId, ticketFolio: folio }),
      crearNotificacion({
        ticketId, ticketFolio: folio, tipo: "asignacion_solicitante", mensaje: mensajeSolicitante,
        paraUid: solicitanteId, paraRoles: null,
      }),
      enviarEmailNotificacion({ tipo: "asignacion_solicitante", mensaje: mensajeSolicitante, ticketId, ticketFolio: folio }),
    ]);
  },

  async ticketReasignado({ ticketId, folio, abogadoId, solicitanteId }) {
    const mensajeSolicitante = `Tu ticket ${folio} fue reasignado a otro abogado.`;
    await Promise.all([
      notificarReasignacion(ticketId, folio, abogadoId),
      enviarEmailNotificacion({ tipo: "reasignacion", mensaje: `Te reasignaron el ticket ${folio}.`, ticketId, ticketFolio: folio }),
      crearNotificacion({
        ticketId, ticketFolio: folio, tipo: "reasignacion_solicitante", mensaje: mensajeSolicitante,
        paraUid: solicitanteId, paraRoles: null,
      }),
      enviarEmailNotificacion({ tipo: "reasignacion_solicitante", mensaje: mensajeSolicitante, ticketId, ticketFolio: folio }),
    ]);
  },

  async ticketCambioEstatus({ ticketId, folio, solicitanteId, estatus, tokenCalificacion }) {
    const tipo = estatus === "Cierre" ? "cierre" : "cambio_estatus";
    const mensaje = estatus === "Cierre" ? `Tu ticket ${folio} fue cerrado.` : `Tu ticket ${folio} cambio de estatus: ${estatus}.`;

    await Promise.all([
      crearNotificacion({ ticketId, ticketFolio: folio, tipo, mensaje, paraUid: solicitanteId, paraRoles: null }),
      enviarEmailNotificacion({ tipo, mensaje, ticketId, ticketFolio: folio, tokenCalificacion: tipo === "cierre" ? tokenCalificacion : undefined }),
    ]);
  },
};
