import type { EtiquetaDocumento, Ticket } from "@/types/ticket";
import { adjuntosSinEtiqueta, aplicarEtiqueta, ETIQUETA_SIN_IDENTIFICAR, limpiarEtiqueta, MAX_BYTES_IMAGEN_ETIQUETA, mimeEtiquetable } from "./etiquetas-rules";
import { nombreDeUrl } from "./nombre-url";

export interface DepsEtiquetas {
  cargarTicket(id: string): Promise<Ticket | null>;
  descargar(url: string): Promise<Buffer>;
  // Devuelve la etiqueta propuesta, o null si no se pudo identificar el documento.
  pedirEtiqueta(mimeType: string, base64: string): Promise<string | null>;
  guardar(ticketId: string, etiquetas: EtiquetaDocumento[]): Promise<void>;
}

export interface ResultadoEtiquetado {
  etiquetados: number;
  sinIdentificar: number;
  errores: number;
}

// Etiqueta, uno por uno, los adjuntos con nombre generico. Un documento que falla (descarga, Gemini) se deja sin
// etiqueta para reintentarlo luego; uno que la IA no reconoce queda marcado como "sin identificar".
export async function etiquetarDocumentosDelTicket(deps: DepsEtiquetas, ticketId: string): Promise<ResultadoEtiquetado> {
  const ticket = await deps.cargarTicket(ticketId);
  if (!ticket) throw new Error("Ticket no encontrado.");

  const resultado: ResultadoEtiquetado = { etiquetados: 0, sinIdentificar: 0, errores: 0 };
  let etiquetas = ticket.etiquetasDocumentos ?? [];

  for (const url of adjuntosSinEtiqueta(ticket)) {
    try {
      const mime = mimeEtiquetable(nombreDeUrl(url));
      if (!mime) continue;
      const buffer = await deps.descargar(url);
      if (buffer.length > MAX_BYTES_IMAGEN_ETIQUETA) throw new Error("excede el limite");

      const propuesta = limpiarEtiqueta((await deps.pedirEtiqueta(mime, buffer.toString("base64"))) ?? "");
      if (propuesta) {
        etiquetas = aplicarEtiqueta(etiquetas, { url, etiqueta: propuesta, origen: "ia" });
        resultado.etiquetados++;
      } else {
        etiquetas = aplicarEtiqueta(etiquetas, { url, etiqueta: ETIQUETA_SIN_IDENTIFICAR, origen: "ia", sinIdentificar: true });
        resultado.sinIdentificar++;
      }
      await deps.guardar(ticketId, etiquetas);
    } catch {
      console.error(`Documento sin etiquetar (ticket ${ticketId}).`);
      resultado.errores++;
    }
  }
  return resultado;
}
