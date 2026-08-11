import type { ContratoArrendamientoInput, DocumentosArrendamientoInput, Ticket } from "@/types/ticket";
import type { CatalogoServicio } from "@/types/catalogo";

export interface NuevoTicketInput {
  solicitanteId: string;
  solicitanteNombre: string;
  areaEmpresa: string;
  servicioId: string;
  descripcion: string;
  documentacion: string[];
  formatoArrendamientoUrl?: string;
  documentosArrendamiento?: DocumentosArrendamientoInput;
  contratoArrendamiento?: ContratoArrendamientoInput;
}

export function buildNuevoTicket(
  input: NuevoTicketInput,
  servicio: CatalogoServicio,
  ctx: { id: string; folio: string },
  ahora: Date
): Ticket {
  const fechaSolicitud = ahora.toISOString();

  return {
    id: ctx.id,
    folio: ctx.folio,
    fechaSolicitud,
    solicitanteId: input.solicitanteId,
    solicitanteNombre: input.solicitanteNombre,
    areaEmpresa: input.areaEmpresa,
    servicioId: input.servicioId,
    descripcion: input.descripcion,
    documentacion: input.documentacion,
    // Firestore rechaza `undefined` explicito.
    ...(input.formatoArrendamientoUrl ? { formatoArrendamientoUrl: input.formatoArrendamientoUrl } : {}),
    ...(input.documentosArrendamiento ? { documentosArrendamiento: input.documentosArrendamiento } : {}),
    ...(input.contratoArrendamiento ? { contratoArrendamiento: input.contratoArrendamiento } : {}),
    categoria: servicio.categoria,
    puestoResponsableSugerido: servicio.puestoResponsable,
    slaInterno: servicio.slaInterno,
    // El SLA arranca al asignar abogado, no aqui (ver asignacion-rules.ts).
    fechaCompromiso: null,
    diasHabilesTranscurridos: null,
    nivelServicio: null,
    diasPipeline: null,
    estatus: "Recepcion de solicitud",
    abogadoAsignadoId: null,
    fechaAsignacion: null,
    fechaCierre: null,
    notasCierre: null,
    tokenCalificacion: null,
    historialEstatus: [{ estatus: "Recepcion de solicitud", fecha: fechaSolicitud, uid: input.solicitanteId }],
  };
}
