import type { Categoria } from "./catalogo";

export const ESTATUS_VALUES = [
  "Recepcion de solicitud",
  "Validacion de informacion con solicitante",
  "Proyeccion de nivel de servicio (SLA)",
  "Asignacion de responsable",
  "Proceso en tramite",
  "Validacion y presentacion de requerimiento",
  "Cierre",
] as const;

export type Estatus = (typeof ESTATUS_VALUES)[number];

export interface HistorialEntry {
  estatus: Estatus;
  fecha: string; // ISO
  uid: string;
}

// Especifico del servicio "Contratos / Convenios de Arrendamiento" — ver
// lib/data/arrendamientos-temporal.ts. Temporal: quitar junto con esa
// restriccion cuando el catalogo se vuelva a abrir por completo.
export interface ContratoArrendamientoInput {
  sitio: string;
  domicilio: string;
  altaArrendador: string;
  solicitante: string;
  periodoInicio: string; // fecha, yyyy-mm-dd
  periodoFin: string; // fecha, yyyy-mm-dd
  condicionesPago: string;
  montoPago: number;
  motivo: string;
  notas: string;
}

// Solo Alta de Arrendadores / Cambio de Arrendador (ver arrendamientos-temporal.ts).
export interface DocumentosArrendamientoInput {
  escrituras: string;
  identificacionArrendador: string;
  predial: string;
  comprobanteDomicilio: string;
}

export interface Ticket {
  id: string; // ID de documento de Firestore (autogenerado, estable) — usar para rutas/lookups
  folio: string; // JUR-0001... — SOLO exhibicion, nunca usar para identificar el ticket

  // Verde — llena el solicitante
  fechaSolicitud: string; // ISO
  solicitanteId: string;
  solicitanteNombre: string;
  areaEmpresa: string;
  servicioId: string; // referencia a CatalogoServicio.id
  descripcion: string;
  documentacion: string[]; // URLs de Storage
  satisfaccion?: number; // 1-10, la llena el solicitante al cierre
  comentarioSatisfaccion?: string; // opcional, junto con satisfaccion
  formatoArrendamientoUrl?: string;
  documentosArrendamiento?: DocumentosArrendamientoInput;
  contratoArrendamiento?: ContratoArrendamientoInput;

  // Gris — calculado por Cloud Function, no editable desde el cliente
  categoria: Categoria;
  puestoResponsableSugerido: string;
  slaInterno: number;
  // SLA: arranca al asignar abogado (ver updateTicketAsignacion), null antes.
  fechaCompromiso: string | null; // ISO, WORKDAY(fechaAsignacion, slaInterno)
  diasHabilesTranscurridos: number | null;
  nivelServicio: number | null; // slaInterno - diasHabilesTranscurridos
  diasPipeline: number | null; // dias habiles fechaSolicitud→cierre, aparte del SLA

  // Ambar — llena Mesa de Control / abogado asignado
  estatus: Estatus;
  abogadoAsignadoId: string | null;
  fechaAsignacion: string | null;
  fechaCierre: string | null;
  notasCierre: string | null;
  // Secreto de un solo uso para calificar sin login desde el correo de cierre
  // (ver app/calificar/[ticketId], api/calificar/[ticketId]/route.ts).
  tokenCalificacion: string | null;

  historialEstatus: HistorialEntry[];
}
