import { addBusinessDays, businessDaysBetween } from "@/lib/business-days";
import type { Estatus, HistorialEntry, Ticket } from "@/types/ticket";

export interface AsignacionInput {
  estatus: Estatus;
  abogadoAsignadoId: string | null;
  notasCierre: string | null;
}

export interface AsignacionResultado {
  patch: Partial<Ticket>;
  esNuevaAsignacion: boolean;
  esCambioEstatus: boolean;
}

// El SLA (fechaCompromiso, diasHabilesTranscurridos, nivelServicio) arranca en
// fechaAsignacion, no en fechaSolicitud; diasPipeline cuenta
// fechaSolicitud→cierre aparte. Ambos se congelan al cerrar (ver
// lib/ticket-derived.ts). Pura: nada de Firestore, solo fechas y aritmetica.
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

  if (input.abogadoAsignadoId && !current.fechaAsignacion) {
    const fechaAsignacion = ahora.toISOString();
    patch.fechaAsignacion = fechaAsignacion;
    patch.fechaCompromiso = addBusinessDays(ahora, current.slaInterno).toISOString();
  }

  if (input.estatus === "Cierre" && !current.fechaCierre) {
    // Si se asigna y cierra en la misma accion, usar la fecha recien fijada.
    const fechaAsignacionEfectiva = patch.fechaAsignacion ?? current.fechaAsignacion;

    patch.fechaCierre = ahora.toISOString();
    patch.diasPipeline = businessDaysBetween(new Date(current.fechaSolicitud), ahora);

    if (fechaAsignacionEfectiva) {
      const dias = businessDaysBetween(new Date(fechaAsignacionEfectiva), ahora);
      patch.diasHabilesTranscurridos = dias;
      patch.nivelServicio = current.slaInterno - dias;
    }
  }

  // Aparte del bloque de arriba (que solo congela el SLA la PRIMERA vez que se
  // cierra): el token de calificacion se regenera cada vez que el ticket
  // ENTRA a Cierre, incluso si ya se habia cerrado y reabierto antes — si no,
  // un ticket reabierto y vuelto a cerrar manda el correo de cierre sin boton
  // de calificar.
  if (input.estatus === "Cierre" && current.estatus !== "Cierre") {
    patch.tokenCalificacion = crypto.randomUUID();
  }

  const historialEntry: HistorialEntry = { estatus: input.estatus, fecha: ahora.toISOString(), uid: actorUid };
  patch.historialEstatus =
    input.estatus !== current.estatus ? [...current.historialEstatus, historialEntry] : current.historialEstatus;

  return {
    patch,
    esNuevaAsignacion: !!input.abogadoAsignadoId && input.abogadoAsignadoId !== current.abogadoAsignadoId,
    esCambioEstatus: input.estatus !== current.estatus,
  };
}
