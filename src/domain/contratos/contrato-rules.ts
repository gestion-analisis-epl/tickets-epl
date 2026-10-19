import type { Estatus, Ticket } from "@/types/ticket";
import { esArchivoContrato } from "./tipo-archivo";
import type { ResumenContrato, ResumenContratoTicket } from "@/types/resumen-contrato";

// Etapas en que se crea o refresca el resumen (accionResumen). La LECTURA del jefe de zona no se limita
// a estas etapas: conserva los tickets que regresan a correccion (ver firestore.rules).
export const ETAPAS_VISIBLES_JEFE_ZONA: readonly Estatus[] = ["Pre-Cierre", "Cierre"];

const esEtapaVisible = (e: Estatus) => ETAPAS_VISIBLES_JEFE_ZONA.includes(e);

// Storage guarda `{timestamp}_{nombre}` (ver lib/storage.ts); se quita el prefijo.
export function nombreDeUrl(url: string): string {
  try {
    const ruta = decodeURIComponent(new URL(url).pathname);
    const archivo = ruta.slice(ruta.lastIndexOf("/") + 1);
    return archivo.replace(/^\d+_/, "");
  } catch {
    return "";
  }
}

export function encontrarContrato(documentacion: string[]): string | null {
  return (
    documentacion.find((url) => {
      const nombre = nombreDeUrl(url);
      return esArchivoContrato(nombre) && nombre.toUpperCase().includes("CONTRATO_ARRENDAMIENTO");
    }) ?? null
  );
}

export const MINUTOS_PENDIENTE_OBSOLETO = 5;

// Un "pendiente" sin marca de tiempo o con mas de 5 minutos se considera atascado.
export function esPendienteObsoleto(resumen: ResumenContratoTicket | undefined, ahora: Date): boolean {
  if (resumen?.estado !== "pendiente") return false;
  if (!resumen.solicitadoEn) return true;
  const inicio = Date.parse(resumen.solicitadoEn);
  if (Number.isNaN(inicio)) return true;
  return ahora.getTime() - inicio > MINUTOS_PENDIENTE_OBSOLETO * 60_000;
}

// Sin resumen, con error o atascado en "pendiente": hay que (re)generarlo.
export function resumenReintentable(resumen: ResumenContratoTicket | undefined, ahora: Date): boolean {
  return !resumen || resumen.estado === "error" || esPendienteObsoleto(resumen, ahora);
}

export function accionResumen(estatusPrevio: Estatus, estatusNuevo: Estatus): "upsert" | "actualizar-estatus" | "ninguna" {
  if (esEtapaVisible(estatusNuevo)) return "upsert";
  if (esEtapaVisible(estatusPrevio)) return "actualizar-estatus";
  return "ninguna";
}

export function construirResumenContrato(ticket: Ticket, ahora: Date, previo?: ResumenContrato | null): ResumenContrato {
  const contrato = ticket.contratoArrendamiento;
  const gemini = ticket.resumenContrato;
  const urlGemini = gemini?.contratoUrl && ticket.documentacion.includes(gemini.contratoUrl) ? gemini.contratoUrl : null;
  const contratoUrl = urlGemini ?? encontrarContrato(ticket.documentacion);
  const extraccion = gemini?.estado === "listo" ? gemini.extraccion : null;

  return {
    ticketId: ticket.id,
    folio: ticket.folio,
    estatus: ticket.estatus,
    sitioClave: ticket.sitioArrendamiento?.clave ?? null,
    sitioAlias: ticket.sitioArrendamiento?.alias ?? contrato?.sitio ?? null,
    domicilio: contrato?.domicilio ?? null,
    solicitante: contrato?.solicitante || ticket.solicitanteNombre,
    altaArrendador: contrato?.altaArrendador ?? null,
    periodoInicio: contrato?.periodoInicio ?? null,
    periodoFin: contrato?.periodoFin ?? null,
    condicionesPago: extraccion?.condicionesPago ?? contrato?.condicionesPago ?? null,
    metodoPago: contrato?.condicionesPago ?? null,
    montoPagoAnual: extraccion?.montoPagoAnual ?? contrato?.montoPago ?? null,
    formaPago: extraccion?.formaPago ?? null,
    discrepancias: gemini?.discrepancias ?? [],
    contratoUrl,
    contratoNombre: contratoUrl ? nombreDeUrl(contratoUrl) : null,
    estadoResumen: extraccion ? "listo" : !contratoUrl ? "sin_contrato" : gemini?.estado ?? "pendiente",
    vistoBueno: previo?.vistoBueno ?? null,
    actualizadoEn: ahora.toISOString(),
  };
}
