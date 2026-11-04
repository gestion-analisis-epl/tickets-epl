// TEMPORAL: restringe creacion de tickets a estos 3 servicios de Arrendamientos.
export const SERVICIO_ALTA_ARRENDADOR_ID = "JUR-C071";
export const SERVICIO_CAMBIO_ARRENDADOR_ID = "JUR-C072";
export const SERVICIO_CONTRATO_ARRENDAMIENTO_ID = "JUR-C073";
export const SERVICIO_ATENCION_ARRENDAMIENTO_ID = "JUR-C074";

export const SERVICIOS_ARRENDAMIENTO_IDS = [
  SERVICIO_ALTA_ARRENDADOR_ID,
  SERVICIO_CAMBIO_ARRENDADOR_ID,
  SERVICIO_CONTRATO_ARRENDAMIENTO_ID,
  SERVICIO_ATENCION_ARRENDAMIENTO_ID,
];

// Alta de Arrendadores y Cambio de Arrendador exigen adjuntar el formato oficial.
export const SERVICIOS_CON_FORMATO_OBLIGATORIO_IDS = [SERVICIO_ALTA_ARRENDADOR_ID, SERVICIO_CAMBIO_ARRENDADOR_ID];

// Los tres capturan los datos del contrato / convenio.
export const SERVICIOS_CON_DATOS_CONTRATO_IDS = [
  SERVICIO_ALTA_ARRENDADOR_ID,
  SERVICIO_CAMBIO_ARRENDADOR_ID,
  SERVICIO_CONTRATO_ARRENDAMIENTO_ID,
];

// Alta y Cambio de arrendador usan exactamente el mismo formulario: tipo de alta, cada documento por separado
// y la revision legal del abogado.
export const SERVICIOS_CON_FORMULARIO_ALTA_IDS = [SERVICIO_ALTA_ARRENDADOR_ID, SERVICIO_CAMBIO_ARRENDADOR_ID];

export function usaFormularioAlta(servicioId: string): boolean {
  return SERVICIOS_CON_FORMULARIO_ALTA_IDS.includes(servicioId);
}

export const SERVICIOS_CON_DOCUMENTOS_INDIVIDUALES_IDS = SERVICIOS_CON_FORMULARIO_ALTA_IDS;

export const URL_FORMATO_SOLICITUD_ARRENDAMIENTO = "/plantillas/formato-solicitud-arrendamiento.docx";

// Los pide por separado el formulario de Alta/Cambio (y sirven de guia en los demas servicios de arrendamiento).
export const DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO = [
  { key: "escrituras", label: "Escrituras de la propiedad" },
  { key: "identificacionArrendador", label: "Identificación oficial del arrendador" },
  { key: "predial", label: "Predial de la propiedad" },
  { key: "comprobanteDomicilio", label: "Comprobante de domicilio" },
] as const;

export type DocumentoRequeridoArrendamientoKey = (typeof DOCUMENTOS_REQUERIDOS_ARRENDAMIENTO)[number]["key"];

// Encabezados fijos del formato oficial que sobreviven aunque se llenen los espacios en blanco.
export const MARCADORES_FORMATO_ARRENDAMIENTO = [
  /FORMATO\s+BASE\s+DE\s+SOLICITUD/i,
  /DATOS\s+DEL\s+ARRENDAMIENTO/i,
  /DOCUMENTACI[OÓ]N\s+REQUERIDA/i,
  /AUTORIZACI[OÓ]N\s+DEL\s+[AÁ]REA/i,
];

// Con 3 de 4 alcanza: Word puede fragmentar un encabezado entre "runs".
export const MARCADORES_MINIMOS_REQUERIDOS = 3;

// Se capturan por separado y se combinan como "63 - Transferencia" antes de guardarse.
export const CONDICIONES_PAGO_CODIGOS = ["01", "63"];
export const CONDICIONES_PAGO_TIPOS = ["Cheques", "Transferencia"];

export const MOTIVO_CONTRATO_OPTIONS = ["Adquisición VEA", "Alta de Arrendador", "Cambio de Arrendador"];
