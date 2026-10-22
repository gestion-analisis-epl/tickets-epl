import type { Estatus } from "./ticket";

export type FormaPago = "mensual" | "bimestral" | "trimestral" | "semestral" | "anual" | "bianual" | "otra";
export type EstadoResumen = "pendiente" | "listo" | "error" | "sin_contrato";

export interface Discrepancia {
  campo: "domicilio" | "periodo" | "arrendador";
  valorTicket: string;
  valorContrato: string;
}

// Lo que Gemini extrae del contrato (Plan B). null = no consta en el contrato.
export interface ExtraccionContrato {
  sitio: string | null;
  codigo: string | null;
  domicilio: string | null;
  altaArrendador: string | null;
  solicitante: string | null;
  periodoInicio: string | null;
  periodoFin: string | null;
  condicionesPago: string | null;
  montoPagoAnual: number | null;
  formaPago: FormaPago | null;
}

// Vive en tickets/{id}.resumenContrato (lo escribe el servidor, Plan B).
export interface ResumenContratoTicket {
  estado: EstadoResumen;
  extraccion: ExtraccionContrato | null;
  discrepancias: Discrepancia[];
  contratoNombre: string | null;
  contratoUrl?: string | null; // URL realmente usada (puede ser un docx elegido a mano)
  generadoEn: string | null; // ISO
  solicitadoEn?: string | null; // ISO; solo en "pendiente", para detectar solicitudes atascadas
  error?: string;
}

export interface VistoBueno {
  uid: string;
  nombre: string;
  fecha: string;
}

export interface DocumentoResumen {
  etiqueta: string;
  url: string;
}

// Documento resumenesContrato/{ticketId}: lo unico que ve el jefe de zona.
export interface ResumenContrato {
  ticketId: string;
  folio: string;
  estatus: Estatus;
  // Ausentes en resumenes previos: se completan con "Crear resumenes faltantes" (Mantenimiento).
  servicioId?: string;
  motivo?: string | null;
  documentos?: DocumentoResumen[];
  sitioClave: string | null;
  sitioAlias: string | null;
  domicilio: string | null;
  solicitante: string;
  altaArrendador: string | null;
  periodoInicio: string | null;
  periodoFin: string | null;
  condicionesPago: string | null;
  // Metodo capturado en la ficha, p. ej. "63 - Cheques". Ausente en resumenes previos.
  metodoPago?: string | null;
  montoPagoAnual: number | null;
  formaPago: FormaPago | null;
  discrepancias: Discrepancia[];
  contratoUrl: string | null;
  contratoNombre: string | null;
  estadoResumen: EstadoResumen;
  vistoBueno: VistoBueno | null;
  actualizadoEn: string; // ISO
}
