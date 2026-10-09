import type { Estatus, Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";

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
      const nombre = nombreDeUrl(url).toUpperCase();
      return nombre.endsWith(".DOCX") && nombre.includes("CONTRATO_ARRENDAMIENTO");
    }) ?? null
  );
}

export function accionResumen(estatusPrevio: Estatus, estatusNuevo: Estatus): "upsert" | "actualizar-estatus" | "ninguna" {
  if (esEtapaVisible(estatusNuevo)) return "upsert";
  if (esEtapaVisible(estatusPrevio)) return "actualizar-estatus";
  return "ninguna";
}

export function construirResumenContrato(ticket: Ticket, ahora: Date, previo?: ResumenContrato | null): ResumenContrato {
  const contrato = ticket.contratoArrendamiento;
  const gemini = ticket.resumenContrato;
  const contratoUrl = gemini?.contratoUrl ?? encontrarContrato(ticket.documentacion);
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
