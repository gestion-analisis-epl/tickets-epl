import { addBusinessDays } from "@/lib/business-days";
import type { Ticket } from "@/types/ticket";
import type { CatalogoServicio } from "@/types/catalogo";

export interface SolicitudInput {
  areaEmpresa: string;
  servicioId: string;
  descripcion: string;
  documentacion: string[];
}

// fechaCompromiso solo existe una vez asignado el abogado.
export function calcularPatchSolicitud(current: Ticket, input: SolicitudInput, servicio: CatalogoServicio): Partial<Ticket> {
  const fechaCompromiso = current.fechaAsignacion
    ? addBusinessDays(new Date(current.fechaAsignacion), servicio.slaInterno).toISOString()
    : null;

  return {
    areaEmpresa: input.areaEmpresa,
    servicioId: input.servicioId,
    descripcion: input.descripcion,
    documentacion: input.documentacion,
    categoria: servicio.categoria,
    puestoResponsableSugerido: servicio.puestoResponsable,
    slaInterno: servicio.slaInterno,
    fechaCompromiso,
  };
}
