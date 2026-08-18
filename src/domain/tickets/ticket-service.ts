import { deleteTicketDocuments } from "@/lib/storage";
import type { Ticket } from "@/types/ticket";
import type { CatalogoLookup } from "@/domain/catalogo/catalogo-lookup";
import type { TicketRepository } from "./ticket-repository";
import type { TicketNotifier } from "./ticket-notifier";
import { buildNuevoTicket, type NuevoTicketInput } from "./nuevo-ticket";
import { calcularPatchAsignacion, type AsignacionInput } from "./asignacion-rules";
import { calcularPatchSolicitud, type SolicitudInput } from "./solicitud-rules";
import { calcularBackfill } from "./backfill-rules";

export interface BackfillResultado {
  actualizados: number;
  omitidos: number;
  detalles: string[];
}

export function createTicketService(repo: TicketRepository, notifier: TicketNotifier, catalogo: CatalogoLookup) {
  async function createTicket(input: NuevoTicketInput): Promise<{ id: string; folio: string }> {
    const servicio = catalogo.findServicio(input.servicioId);
    if (!servicio) throw new Error("Servicio no encontrado en el catalogo.");

    let mensaje = "";
    const resultado = await repo.create(({ id, folio }) => {
      mensaje = `Nueva solicitud ${folio}: ${servicio.servicio}`;
      return { ticket: buildNuevoTicket(input, servicio, { id, folio }, new Date()), notificacionMensaje: mensaje };
    });

    await notifier
      .ticketCreado({ ticketId: resultado.id, folio: resultado.folio, mensaje, solicitanteId: input.solicitanteId })
      .catch(() => {});

    return resultado;
  }

  function subscribeTickets(filter: Parameters<TicketRepository["subscribeMany"]>[0], callback: (tickets: Ticket[]) => void) {
    return repo.subscribeMany(filter, callback);
  }

  function subscribeTicket(
    id: string,
    callback: (ticket: Ticket | null) => void,
    onError?: Parameters<TicketRepository["subscribeOne"]>[2]
  ) {
    return repo.subscribeOne(id, callback, onError);
  }

  async function updateTicketAsignacion(id: string, actorUid: string, input: AsignacionInput): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");

    const { patch, esNuevaAsignacion, esCambioEstatus } = calcularPatchAsignacion(current, input, actorUid, new Date());
    await repo.update(id, patch);

    // Best-effort: si fallan no bloquean el cambio, que ya se guardo.
    const avisos: Promise<unknown>[] = [];

    if (esNuevaAsignacion && input.abogadoAsignadoId) {
      avisos.push(
        notifier.ticketAsignado({
          ticketId: id, folio: current.folio, abogadoId: input.abogadoAsignadoId, solicitanteId: current.solicitanteId,
        })
      );
    }

    if (esCambioEstatus) {
      avisos.push(
        notifier.ticketCambioEstatus({
          ticketId: id,
          folio: current.folio,
          solicitanteId: current.solicitanteId,
          estatus: input.estatus,
          tokenCalificacion: patch.tokenCalificacion ?? undefined,
        })
      );
    }

    await Promise.all(avisos).catch(() => {});
  }

  async function updateTicketSolicitud(id: string, input: SolicitudInput): Promise<void> {
    const servicio = catalogo.findServicio(input.servicioId);
    if (!servicio) throw new Error("Servicio no encontrado en el catalogo.");

    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");

    await repo.update(id, calcularPatchSolicitud(current, input, servicio));
  }

  async function deleteTicket(id: string): Promise<void> {
    const current = await repo.getById(id);
    if (current) await deleteTicketDocuments(current.documentacion);
    await repo.delete(id);
  }

  async function submitSatisfaccion(id: string, satisfaccion: number, comentario?: string): Promise<void> {
    await repo.update(id, { satisfaccion, ...(comentario ? { comentarioSatisfaccion: comentario } : {}) });
  }

  async function backfillSlaHistorico(): Promise<BackfillResultado> {
    const cerrados = await repo.listCerrados();
    const detalles: string[] = [];
    let actualizados = 0;
    let omitidos = 0;

    for (const t of cerrados) {
      const calculo = calcularBackfill(t);
      if (calculo.omitido) {
        detalles.push(`[omitido] ${t.folio ?? t.id}: sin fechaSolicitud/fechaCierre.`);
        omitidos++;
        continue;
      }

      await repo.update(t.id, {
        diasPipeline: calculo.diasPipeline,
        diasHabilesTranscurridos: calculo.diasHabilesTranscurridos,
        nivelServicio: calculo.nivelServicio,
      });
      actualizados++;
      detalles.push(
        `[ok] ${t.folio ?? t.id}: diasPipeline=${calculo.diasPipeline}, nivelServicio=${calculo.nivelServicio ?? "null (nunca se asigno)"}`
      );
    }

    return { actualizados, omitidos, detalles };
  }

  return {
    createTicket,
    subscribeTickets,
    subscribeTicket,
    updateTicketAsignacion,
    updateTicketSolicitud,
    deleteTicket,
    submitSatisfaccion,
    backfillSlaHistorico,
  };
}
