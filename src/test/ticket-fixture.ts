import type { Ticket } from "@/types/ticket";

export function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    folio: "JUR-0001",
    fechaSolicitud: "2024-01-08T12:00:00.000Z",
    solicitanteId: "user-1",
    solicitanteNombre: "Juan Perez",
    areaEmpresa: "Grupo EPL",
    servicioId: "JUR-C001",
    descripcion: "Descripcion de prueba",
    documentacion: [],
    categoria: "Contratos",
    puestoResponsableSugerido: "Abogado",
    slaInterno: 5,
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
    historialEstatus: [],
    ...overrides,
  };
}
