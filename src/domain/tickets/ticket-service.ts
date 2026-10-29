import { deleteTicketDocuments } from "@/lib/storage";
import type { Estatus, RevisionLegal, SitioArrendamiento, Ticket } from "@/types/ticket";
import { etapaPermiteEditar, normalizarRevisionLegal, revisionLegalPendiente, RevisionLegalIncompletaError } from "./revision-legal-rules";
import { calcularPatchAltaRetroactiva, esAltaRetroactiva, validarAltaRetroactiva, type AltaRetroactivaCapturada } from "./alta-arrendador-rules";
import { SERVICIO_ALTA_ARRENDADOR_ID } from "@/lib/data/arrendamientos-temporal";
import type { ResumenContratoRepository } from "@/domain/contratos/resumen-contrato-repository";
import { accionResumen, construirResumenContrato, ETAPAS_VISIBLES_JEFE_ZONA, resumenSinCambios } from "@/domain/contratos/contrato-rules";
import type { CatalogoLookup } from "@/domain/catalogo/catalogo-lookup";
import type { TicketRepository } from "./ticket-repository";
import type { TicketNotifier } from "./ticket-notifier";
import { buildNuevoTicket, type NuevoTicketInput } from "./nuevo-ticket";
import { calcularPatchAsignacion, type AsignacionInput } from "./asignacion-rules";
import { calcularPatchSolicitud, type SolicitudInput } from "./solicitud-rules";
import { calcularBackfill } from "./backfill-rules";
import { primeraEntradaPreCierre, ticketLlegoAPreCierreOCierre } from "@/domain/contratos/backfill-rules";
import { calcularPatchSitio } from "./sitio-rules";
import { calcularPatchContrato, type ContratoEdicionInput } from "./contrato-edicion-rules";
import type { ActorHistorial } from "@/types/historial";
import { bloqueadoPorPreCierre, MENSAJE_BLOQUEO_PRE_CIERRE, solicitudEditable } from "./etapa-permisos-rules";
import { requiereDatosContrato } from "./contrato-edicion-rules";
import { conVisibilidad, entradaContrato, entradaExclusion, entradaSitio, entradasAsignacion, entradasSolicitud } from "./historial-rules";

export interface BackfillResultado {
  actualizados: number;
  omitidos: number;
  detalles: string[];
}

export interface ResumenesFaltantesResultado {
  creados: number;
  actualizados: number;
  conversacionesMarcadas: number;
  errores: string[];
}

export function createTicketService(
  repo: TicketRepository,
  notifier: TicketNotifier,
  catalogo: CatalogoLookup,
  resumenes: ResumenContratoRepository
) {
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

  async function sincronizarResumen(ticket: Ticket, estatusPrevio: Estatus): Promise<void> {
    const accion = accionResumen(estatusPrevio, ticket.estatus);
    if (accion === "ninguna") return;
    const ahora = new Date();
    if (accion === "actualizar-estatus") return resumenes.updateEstatus(ticket.id, ticket.estatus, ahora.toISOString());
    // Se relee el ticket: la ruta de Gemini pudo escribir el resumen mientras tanto.
    const fresco = await repo.getById(ticket.id);
    const vigente = fresco ? ({ ...ticket, resumenContrato: fresco.resumenContrato } as Ticket) : ticket;
    const previo = await resumenes.get(ticket.id);
    await resumenes.upsert(construirResumenContrato(vigente, ahora, previo));
  }

  // Best-effort: refresca el resumen cuando el ticket se edita estando en Pre-Cierre/Cierre.
  async function refrescarResumenSiVisible(ticket: Ticket): Promise<void> {
    if (!ETAPAS_VISIBLES_JEFE_ZONA.includes(ticket.estatus)) return;
    try {
      const fresco = await repo.getById(ticket.id);
      const vigente = fresco ? ({ ...ticket, resumenContrato: fresco.resumenContrato } as Ticket) : ticket;
      const previo = await resumenes.get(ticket.id);
      await resumenes.upsert(construirResumenContrato(vigente, new Date(), previo));
    } catch (err) {
      console.error("No se pudo refrescar el resumen de contrato:", err);
    }
  }

  async function updateTicketAsignacion(id: string, actor: ActorHistorial, input: AsignacionInput): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");
    if ((input.estatus === "Pre-Cierre" || input.estatus === "Cierre") && solicitudEditable(current.estatus)) {
      const faltantes = revisionLegalPendiente(current);
      if (faltantes.length > 0) throw new RevisionLegalIncompletaError(faltantes);
    }

    const ahora = new Date();
    const { patch, esNuevaAsignacion, esReasignacion, esCambioEstatus } = calcularPatchAsignacion(
      current, input, actor.uid, ahora
    );
    const estatusPrevio = current.estatus;
    await repo.updateConHistorial(id, patch, conVisibilidad(entradasAsignacion(current, patch, actor, ahora), current, actor));

    if (esCambioEstatus) {
      await sincronizarResumen({ ...current, ...patch } as Ticket, estatusPrevio).catch((err) =>
        console.error("No se pudo sincronizar el resumen de contrato:", err)
      );
    }

    // Best-effort: si fallan no bloquean el cambio, que ya se guardo.
    const avisos: Promise<unknown>[] = [];

    if (esNuevaAsignacion && input.abogadoAsignadoId) {
      avisos.push(
        (esReasignacion ? notifier.ticketReasignado : notifier.ticketAsignado)({
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

  // Reenvia el aviso de reasignacion (correo + notificacion in-app) sin tocar el ticket ni
  // el SLA — para casos donde el correo original fallo (ver ticket-notifier.ts).
  async function reenviarNotificacionReasignacion(folio: string): Promise<void> {
    const ticket = await repo.getByFolio(folio);
    if (!ticket) throw new Error(`No se encontro el ticket ${folio}.`);
    if (!ticket.abogadoAsignadoId) throw new Error(`El ticket ${folio} no tiene abogado asignado.`);

    await notifier.ticketReasignado({
      ticketId: ticket.id, folio: ticket.folio, abogadoId: ticket.abogadoAsignadoId, solicitanteId: ticket.solicitanteId,
    });
  }

  async function updateTicketSolicitud(id: string, actor: ActorHistorial, input: SolicitudInput): Promise<void> {
    const servicio = catalogo.findServicio(input.servicioId);
    if (!servicio) throw new Error("Servicio no encontrado en el catalogo.");

    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");
    if (bloqueadoPorPreCierre(current.estatus)) throw new Error(MENSAJE_BLOQUEO_PRE_CIERRE);

    const ahora = new Date();
    const patch = calcularPatchSolicitud(current, input, servicio);
    const nombreServicio = (servicioId: string) => catalogo.findServicio(servicioId)?.servicio ?? null;
    await repo.updateConHistorial(id, patch, conVisibilidad(entradasSolicitud(current, patch, actor, ahora, nombreServicio), current, actor));
    await refrescarResumenSiVisible({ ...current, ...patch } as Ticket);
  }

  async function updateTicketSitio(id: string, actor: ActorHistorial, sitio: SitioArrendamiento): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");
    if (bloqueadoPorPreCierre(current.estatus)) throw new Error(MENSAJE_BLOQUEO_PRE_CIERRE);

    const ahora = new Date();
    const patch = calcularPatchSitio(sitio, actor.uid, ahora);
    const entrada = entradaSitio(current, patch, actor, ahora);
    await repo.updateConHistorial(id, patch, entrada ? conVisibilidad([entrada], current, actor) : []);
    await refrescarResumenSiVisible({ ...current, ...patch } as Ticket);
  }

  async function updateTicketContrato(id: string, actor: ActorHistorial, input: ContratoEdicionInput): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");
    if (!current.contratoArrendamiento && !requiereDatosContrato(current.servicioId)) throw new Error("El ticket no tiene datos de contrato.");
    if (bloqueadoPorPreCierre(current.estatus)) throw new Error(MENSAJE_BLOQUEO_PRE_CIERRE);

    const patch = calcularPatchContrato(current, input);
    const entrada = entradaContrato(current, { ...current.contratoArrendamiento, ...input }, actor, new Date());
    await repo.updateConHistorial(id, patch, entrada ? conVisibilidad([entrada], current, actor) : []);
    await refrescarResumenSiVisible({ ...current, ...patch } as Ticket);
  }

  async function updateTicketRevisionLegal(id: string, revision: RevisionLegal): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");
    if (current.servicioId !== SERVICIO_ALTA_ARRENDADOR_ID) throw new Error("El ticket no es una alta de arrendador.");
    if (!etapaPermiteEditar(current)) {
      throw new Error("La revisión legal ya no se puede editar porque el ticket está en Pre-Cierre o Cierre.");
    }
    await repo.update(id, { revisionLegal: normalizarRevisionLegal(revision) });
  }

  // Tickets de Alta anteriores al formulario nuevo: el abogado completa lo que el solicitante no capturo,
  // en cualquier etapa menos Pre-Cierre (incluido Cierre).
  async function updateTicketAltaRetroactiva(id: string, entrada: AltaRetroactivaCapturada): Promise<void> {
    const errores = validarAltaRetroactiva(entrada);
    const primero = Object.values(errores)[0];
    if (primero) throw new Error(primero);

    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");
    if (!esAltaRetroactiva(current)) throw new Error("Este ticket ya tiene los datos de alta capturados por el solicitante.");
    if (bloqueadoPorPreCierre(current.estatus)) throw new Error(MENSAJE_BLOQUEO_PRE_CIERRE);

    const patch = calcularPatchAltaRetroactiva(entrada);
    await repo.update(id, patch);
    await refrescarResumenSiVisible({ ...current, ...patch } as Ticket);
  }

  async function updateTicketExclusion(id: string, actor: ActorHistorial, excluido: boolean): Promise<void> {
    const current = await repo.getById(id);
    if (!current) throw new Error("Ticket no encontrado.");

    const entrada = entradaExclusion(current, excluido, actor, new Date());
    await repo.updateConHistorial(id, { excluidoDelPipeline: excluido }, entrada ? conVisibilidad([entrada], current, actor) : []);

    // El resumen es lo unico que ven jefe de zona y Sitios: la marca viaja con el, conservando el visto bueno.
    const previo = await resumenes.get(id);
    if (previo) await resumenes.upsert(construirResumenContrato({ ...current, excluidoDelPipeline: excluido }, new Date(), previo));
  }

  async function deleteTicket(id: string): Promise<void> {
    const current = await repo.getById(id);
    if (current) await deleteTicketDocuments(current.documentacion);
    await repo.delete(id);
    await resumenes.delete(id).catch((err) => console.error("No se pudo borrar el resumen de contrato:", err));
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

  // Crea el documento de resumen de todo ticket que esta o estuvo en Pre-Cierre/Cierre y no lo tiene, y marca la
  // conversacion como abierta en los que ya pasaron por Pre-Cierre. No toca el historial ni el SLA: es un arreglo de datos.
  async function crearResumenesFaltantes(tickets: Ticket[]): Promise<ResumenesFaltantesResultado> {
    const resultado: ResumenesFaltantesResultado = { creados: 0, actualizados: 0, conversacionesMarcadas: 0, errores: [] };

    for (const t of tickets) {
      if (!ticketLlegoAPreCierreOCierre(t)) continue;
      try {
        const previo = await resumenes.get(t.id);
        const nuevo = construirResumenContrato(t, new Date(), previo);
        if (!previo) {
          await resumenes.upsert(nuevo);
          resultado.creados++;
        } else if (!resumenSinCambios(previo, nuevo)) {
          // Resumen desfasado respecto al ticket (campos nuevos, exclusion, datos leidos del contrato...):
          // se reconstruye conservando el visto bueno.
          await resumenes.upsert(nuevo);
          resultado.actualizados++;
        }
        const entrada = primeraEntradaPreCierre(t);
        if (entrada && !t.conversacionAbiertaEn) {
          await repo.update(t.id, { conversacionAbiertaEn: entrada });
          resultado.conversacionesMarcadas++;
        }
      } catch (err) {
        resultado.errores.push(`${t.folio ?? t.id}: ${err instanceof Error ? err.message : "error desconocido"}`);
      }
    }
    return resultado;
  }

  return {
    createTicket,
    crearResumenesFaltantes,
    subscribeTickets,
    subscribeTicket,
    updateTicketAsignacion,
    reenviarNotificacionReasignacion,
    updateTicketSolicitud,
    updateTicketSitio,
    updateTicketContrato,
    updateTicketRevisionLegal,
    updateTicketAltaRetroactiva,
    updateTicketExclusion,
    deleteTicket,
    submitSatisfaccion,
    backfillSlaHistorico,
  };
}
