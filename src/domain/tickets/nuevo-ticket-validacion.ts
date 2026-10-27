import { parseMontoInput } from "@/lib/text-format";
import { validarAlta, type AltaCapturada } from "./alta-arrendador-rules";

export interface ContratoCapturado {
  domicilio: string;
  altaArrendador: string;
  solicitante: string;
  periodoInicio: string;
  periodoFin: string;
  condicionesCodigo: string;
  condicionesTipo: string;
  montoPago: string;
  motivo: string;
}

export interface SolicitudCapturada {
  areaEmpresa: string;
  servicioId: string;
  descripcion: string;
  sitioListo: boolean;
  requiereFormato: boolean;
  formatoListo: boolean;
  documentacionObligatoria: boolean;
  documentacionListos: number;
  documentosFaltantes: { key: string; label: string }[];
  requiereDatosContrato: boolean;
  contrato: ContratoCapturado;
  alta?: AltaCapturada;
}

export function validarContrato(contrato: ContratoCapturado): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!contrato.domicilio.trim()) errores.domicilio = "Captura el domicilio.";
  if (!contrato.altaArrendador.trim()) errores.altaArrendador = "Captura el arrendador dado de alta.";
  if (!contrato.solicitante.trim()) errores.solicitante = "Captura el solicitante.";
  if (!contrato.periodoInicio) errores.periodoInicio = "Captura la fecha de inicio.";
  if (!contrato.periodoFin) errores.periodoFin = "Captura la fecha de fin.";
  if (contrato.periodoInicio && contrato.periodoFin && contrato.periodoFin < contrato.periodoInicio) {
    errores.periodoFin = "La fecha de fin no puede ser anterior a la de inicio.";
  }
  if (!contrato.condicionesCodigo || !contrato.condicionesTipo) errores.condicionesPago = "Selecciona las condiciones para pago.";
  const monto = parseMontoInput(contrato.montoPago);
  if (!contrato.montoPago.trim() || !Number.isFinite(monto) || monto <= 0) errores.montoPago = "Captura un monto valido.";
  if (!contrato.motivo) errores.motivo = "Selecciona el motivo.";
  return errores;
}

export function validarSolicitud(s: SolicitudCapturada): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!s.areaEmpresa) errores.areaEmpresa = "Selecciona el area o empresa solicitante.";
  if (!s.servicioId) errores.servicioId = "Selecciona el servicio que necesitas.";
  if (!s.descripcion.trim()) errores.descripcion = "Describe brevemente la solicitud.";
  if (s.servicioId && !s.sitioListo) errores.sitio = "Selecciona el sitio (clave y alias).";

  if (s.requiereFormato) {
    if (!s.formatoListo) errores.formato = "Adjunta el formato de solicitud de arrendamiento (obligatorio para este servicio).";
  }
  if (s.documentacionObligatoria && s.documentacionListos < 1) {
    errores.documentacion = "Adjunta la documentacion de soporte (al menos un archivo).";
  }
  for (const doc of s.documentosFaltantes) errores[doc.key] = `Adjunta: ${doc.label}.`;

  if (s.requiereDatosContrato) Object.assign(errores, validarContrato(s.contrato));
  if (s.alta) {
    // El domicilio de texto se arma con los campos desglosados: el error visible es el de cada campo.
    delete errores.domicilio;
    Object.assign(errores, validarAlta(s.alta));
  }
  return errores;
}
