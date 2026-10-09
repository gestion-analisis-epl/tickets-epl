import { addBusinessDays, businessDaysBetween } from "@/lib/business-days";
import { diasHabilesSla } from "./sla-pausa-rules";
import type { Estatus, HistorialEntry, Ticket } from "@/types/ticket";

export interface AsignacionInput {
  estatus: Estatus;
  abogadoAsignadoId: string | null;
  notasCierre: string | null;
}

export interface AsignacionResultado {
  patch: Partial<Ticket>;
  esNuevaAsignacion: boolean;
  esReasignacion: boolean;
  esCambioEstatus: boolean;
}

// El SLA arranca en fechaAsignacion, no en fechaSolicitud; diasPipeline es aparte.
export function calcularPatchAsignacion(
  current: Ticket,
  input: AsignacionInput,
  actorUid: string,
  ahora: Date
): AsignacionResultado {
  const patch: Partial<Ticket> = {
    estatus: input.estatus,
    abogadoAsignadoId: input.abogadoAsignadoId,
    notasCierre: input.notasCierre,
  };

  const esReasignacion =
    !!input.abogadoAsignadoId && !!current.abogadoAsignadoId && input.abogadoAsignadoId !== current.abogadoAsignadoId;

  // Primera asignacion o reasignacion a otro abogado: el SLA reinicia desde cero en ambos casos.
  if (input.abogadoAsignadoId && (!current.fechaAsignacion || esReasignacion)) {
    const fechaAsignacion = ahora.toISOString();
    patch.fechaAsignacion = fechaAsignacion;
    patch.fechaCompromiso = addBusinessDays(ahora, current.slaInterno).toISOString();
  }

  const historialEntry: HistorialEntry = { estatus: input.estatus, fecha: ahora.toISOString(), uid: actorUid };
  patch.historialEstatus =
    input.estatus !== current.estatus ? [...current.historialEstatus, historialEntry] : current.historialEstatus;

  if (input.estatus === "Cierre" && !current.fechaCierre) {
    // Si se asigna y cierra en la misma accion, usar la fecha recien fijada.
    const fechaAsignacionEfectiva = patch.fechaAsignacion ?? current.fechaAsignacion;

    patch.fechaCierre = ahora.toISOString();
    patch.diasPipeline = businessDaysBetween(new Date(current.fechaSolicitud), ahora);

    if (fechaAsignacionEfectiva) {
      // El tiempo en Pre-Cierre (pausa del SLA) no cuenta; diasPipeline si.
      const dias = diasHabilesSla({ fechaAsignacion: fechaAsignacionEfectiva, historialEstatus: patch.historialEstatus }, ahora);
      patch.diasHabilesTranscurridos = dias;
      patch.nivelServicio = current.slaInterno - dias;
    }
  }

  // El token se regenera cada vez que entra a Cierre, aunque ya se haya cerrado antes.
  if (input.estatus === "Cierre" && current.estatus !== "Cierre") {
    patch.tokenCalificacion = crypto.randomUUID();
  }

  return {
    patch,
    esNuevaAsignacion: !!input.abogadoAsignadoId && input.abogadoAsignadoId !== current.abogadoAsignadoId,
    esReasignacion,
    esCambioEstatus: input.estatus !== current.estatus,
  };
}
