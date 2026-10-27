import type { Categoria } from "./catalogo";
import type { ResumenContratoTicket } from "./resumen-contrato";

export const ESTATUS_VALUES = [
  "Recepcion de solicitud",
  "Validacion de informacion con solicitante",
  "Proyeccion de nivel de servicio (SLA)",
  "Asignacion de responsable",
  "Proceso en tramite",
  "Validacion y presentacion de requerimiento",
  "Pre-Cierre",
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
  // Texto libre: solo tickets previos al selector de sitios (ver Ticket.sitioArrendamiento).
  sitio?: string;
  domicilio: string;
  altaArrendador: string;
  solicitante: string;
  periodoInicio: string; // fecha, yyyy-mm-dd
  periodoFin: string; // fecha, yyyy-mm-dd
  condicionesPago: string;
  montoPago: number;
  motivo: string;
  // Ya no se captura: solo existe en tickets previos. La descripcion de la solicitud la reemplaza.
  notas?: string;
}

// Sitio elegido del catalogo en Google Sheets. Se guarda copiado: si la hoja cambia,
// el ticket conserva lo que se eligio.
export interface SitioArrendamiento {
  clave: string;
  alias: string;
}

// Solo Alta de Arrendadores / Cambio de Arrendador (ver arrendamientos-temporal.ts).
export interface DocumentosArrendamientoInput {
  escrituras: string;
  identificacionArrendador: string;
  predial: string;
  comprobanteDomicilio: string;
}

export type TipoAlta = "nuevo" | "cambio";

export interface DomicilioDesglosado {
  calle: string;
  numero: string;
  interior: string; // opcional: "" si no aplica
  colonia: string;
  municipio: string;
  estado: string;
  cp: string;
  entreCalles: string;
}

export type DocumentoAltaKey =
  | "identificaciones" | "personalidadLegal" | "acreditacionPropiedad"
  | "predial" | "comprobanteDomicilio" | "contratoAnterior";

// Solo Alta de Arrendadores (JUR-C071). Lo llena el solicitante.
export interface AltaArrendadorInput {
  tipoAlta: TipoAlta;
  motivoCambio?: string; // solo si tipoAlta === "cambio"
  domicilio: DomicilioDesglosado;
  geolocalizacion?: string; // copiada de la hoja de sitios; ausente si la hoja no la trae
  documentos: Partial<Record<DocumentoAltaKey, string>>; // URLs de Storage
}

export type TipoPropietario = "fisica" | "moral";
export type EscenarioBeneficiario = "propietario" | "tercero" | "varios";
export type ModalidadVarios = "equitativo" | "representante";

export interface Beneficiario {
  nombre: string;
  porcentaje: number; // centesimas de por ciento: 10000 = 100 %
}

// Lo llena el abogado asignado. Todo opcional: se guarda a medias.
export interface RevisionLegal {
  tipoPropietario?: TipoPropietario;
  nombrePropietario?: string; // persona fisica: nombre completo; moral: razon social
  representanteLegal?: string; // solo moral
  documentoPersonalidad?: string; // solo moral (URL)
  acreditaPropiedad?: boolean;
  documentoPropiedad?: string; // si acreditaPropiedad === true
  cartaAutorizacion?: string; // si acreditaPropiedad === false
  hayLimitacion?: boolean;
  tipoLimitacion?: string; // si hayLimitacion === true
  escenarioBeneficiario?: EscenarioBeneficiario;
  beneficiarioNombre?: string; // escenario "tercero"
  documentoBeneficiario?: string; // escenario "tercero"
  clausulaEspecial?: boolean; // escenario "tercero": recordatorio del abogado
  modalidadVarios?: ModalidadVarios; // escenario "varios"
  beneficiarios?: Beneficiario[]; // escenario "varios"
  representanteComun?: number; // indice en beneficiarios, modalidad "representante"
  documentoRepresentante?: string; // modalidad "representante"
  cartaRepresentante?: string; // modalidad "representante"
  hayCondicionPago?: boolean;
  condicionPago?: string; // si hayCondicionPago === true
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
  altaArrendador?: AltaArrendadorInput; // JUR-C071; ausente en tickets previos
  revisionLegal?: RevisionLegal; // la llena el abogado asignado
  resumenContrato?: ResumenContratoTicket; // lo escribe el servidor (Plan B)
  // Los 4 servicios de arrendamiento. Ausente en tickets previos al selector.
  sitioArrendamiento?: SitioArrendamiento;
  // Se llenan solo cuando Mesa de Control / admin asigna el sitio a un ticket existente.
  sitioActualizadoPor?: string;
  sitioActualizadoEn?: string; // ISO

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

  // Ticket de prueba sacado a mano desde Mantenimiento: no aparece en tabla, kanban ni dashboard.
  excluidoDelPipeline?: boolean;

  // Se fija la primera vez que el ticket entra a Pre-Cierre: habilita la conversacion (ver conversacion-rules.ts).
  conversacionAbiertaEn?: string; // ISO
}
