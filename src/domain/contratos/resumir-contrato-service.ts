import { isAdminRole, LEGAL_STAFF_ROLES, esRolSoloResumen, type Role } from "@/types/user";
import type { Ticket } from "@/types/ticket";
import type { ResumenContratoTicket } from "@/types/resumen-contrato";
import { documentosDelResumen, documentosParaResumen, nombreDeUrl, resumenReintentable, type DocumentoLeible } from "./contrato-rules";
import { tipoContrato, type TipoContrato } from "./tipo-archivo";
import { construirContenido, parsearExtraccion } from "./extraccion-rules";
import { calcularDiscrepancias } from "./discrepancias-rules";
import { ticketLlegoAPreCierreOCierre } from "./backfill-rules";

export type ContenidoGemini = { tipo: "texto"; texto: string } | { tipo: "pdf"; base64: string };
export interface DocumentoGemini { etiqueta: string; contenido: ContenidoGemini }

export interface DepsResumen {
  cargarTicket(id: string): Promise<Ticket | null>;
  descargar(url: string): Promise<Buffer>;
  // docx: texto extraido; pdf: el PDF en base64 (Gemini lo lee directamente).
  prepararContenido(buffer: Buffer, tipo: TipoContrato): Promise<ContenidoGemini>;
  llamarGemini(documentos: DocumentoGemini[]): Promise<string>;
  guardar(ticketId: string, resumen: ResumenContratoTicket): Promise<void>;
  ahora(): Date;
}

const MENSAJE_ERROR = "No se pudo generar el resumen.";
const MIN_CARACTERES_UTILES = 50;
// Gemini admite ~20 MB por peticion y el base64 agrega ~33%: los PDF de una misma peticion no deben sumar mas de ~12 MB.
export const MAX_BYTES_PDF_TOTAL = 12 * 1024 * 1024;

export class ValidacionResumenError extends Error {}

export function puedeGenerarResumen(actor: { uid: string; role: Role }, ticket: Ticket, ahora: Date = new Date()): { permitido: boolean; puedeElegirArchivo: boolean } {
  if (LEGAL_STAFF_ROLES.includes(actor.role) || isAdminRole(actor.role)) return { permitido: true, puedeElegirArchivo: true };
  // Jefe de zona y Sitios no leen tickets: lo piden desde Pre-Cierre/Cierre. Solo si el resumen falta, fallo o quedo
  // atascado, y en tickets que ya estan o estuvieron en esas etapas y no estan excluidos.
  if (esRolSoloResumen(actor.role)) {
    const permitido = ticketLlegoAPreCierreOCierre(ticket) && !ticket.excluidoDelPipeline && resumenReintentable(ticket.resumenContrato, ahora);
    return { permitido, puedeElegirArchivo: false };
  }
  const esDueno = actor.uid === ticket.solicitanteId;
  return { permitido: esDueno && resumenReintentable(ticket.resumenContrato, ahora), puedeElegirArchivo: false };
}

export async function generarResumenContrato(deps: DepsResumen, ticketId: string, archivoUrl?: string): Promise<ResumenContratoTicket> {
  const ticket = await deps.cargarTicket(ticketId);
  if (!ticket) throw new Error("Ticket no encontrado.");

  if (archivoUrl) {
    if (!documentosDelResumen(ticket, null).some((d) => d.url === archivoUrl)) throw new ValidacionResumenError("El archivo no pertenece al ticket.");
    if (!tipoContrato(nombreDeUrl(archivoUrl))) throw new ValidacionResumenError("Solo se admiten archivos docx o pdf.");
  }
  // Archivo elegido a mano: solo ese. Si no, todo lo legible del ticket (contrato primero).
  const candidatos: DocumentoLeible[] = archivoUrl
    ? [{ url: archivoUrl, etiqueta: nombreDeUrl(archivoUrl) }]
    : documentosParaResumen(ticket);

  if (candidatos.length === 0) {
    const sinContrato: ResumenContratoTicket = {
      estado: "sin_contrato", extraccion: null, discrepancias: [], contratoNombre: null, contratoUrl: null, generadoEn: deps.ahora().toISOString(),
    };
    await deps.guardar(ticketId, sinContrato);
    return sinContrato;
  }

  const principal = candidatos[0];
  const principalNombre = nombreDeUrl(principal.url);
  await deps.guardar(ticketId, {
    estado: "pendiente", extraccion: null, discrepancias: [], contratoNombre: principalNombre, contratoUrl: principal.url, generadoEn: null, solicitadoEn: deps.ahora().toISOString(),
  });

  const usados: DocumentoLeible[] = [];
  let bytesPdf = 0;
  try {
    // Un documento ilegible (descarga fallida, docx vacio) se salta; solo falla todo si ninguno sirve.
    const documentos: DocumentoGemini[] = [];
    for (const c of candidatos) {
      try {
        const tipo = tipoContrato(nombreDeUrl(c.url));
        if (!tipo) continue;
        const buffer = await deps.descargar(c.url);
        if (tipo === "pdf") {
          // Presupuesto de la peticion: lo que ya no cabe se omite (el contrato va primero y tiene prioridad).
          if (bytesPdf + buffer.length > MAX_BYTES_PDF_TOTAL) continue;
          bytesPdf += buffer.length;
        }
        const preparado = await deps.prepararContenido(buffer, tipo);
        if (preparado.tipo === "texto") {
          if (preparado.texto.trim().length < MIN_CARACTERES_UTILES) continue;
          documentos.push({ etiqueta: c.etiqueta, contenido: { tipo: "texto", texto: construirContenido(preparado.texto) } });
        } else {
          documentos.push({ etiqueta: c.etiqueta, contenido: preparado });
        }
        usados.push(c);
      } catch {
        console.error(`Documento omitido del resumen (ticket ${ticketId}).`);
      }
    }
    if (documentos.length === 0) throw new Error("Ningun documento se pudo leer.");

    let respuesta: string;
    try {
      respuesta = await deps.llamarGemini(documentos);
    } catch (err) {
      if (documentos.length === 1) throw err;
      // Con varios documentos la peticion puede ser demasiado grande o lenta: se reintenta solo con el principal.
      console.error(`Gemini fallo con ${documentos.length} documentos (ticket ${ticketId}); se reintenta con uno.`);
      respuesta = await deps.llamarGemini([documentos[0]]);
      usados.splice(1);
    }
    const parseada = parsearExtraccion(respuesta);
    if (!parseada.ok) throw new Error(parseada.error);

    const listo: ResumenContratoTicket = {
      estado: "listo",
      extraccion: parseada.extraccion,
      discrepancias: calcularDiscrepancias(ticket, parseada.extraccion),
      contratoNombre: nombreDeUrl(usados[0].url),
      contratoUrl: usados[0].url,
      documentosLeidos: usados.map((u) => u.etiqueta),
      generadoEn: deps.ahora().toISOString(),
    };
    await deps.guardar(ticketId, listo);
    return listo;
  } catch (err) {
    console.error(`Resumen de contrato fallo (ticket ${ticketId}):`, err instanceof Error ? err.message : "error desconocido");
    const fallo: ResumenContratoTicket = {
      estado: "error", extraccion: null, discrepancias: [], contratoNombre: principalNombre, contratoUrl: principal.url, generadoEn: deps.ahora().toISOString(), error: MENSAJE_ERROR,
    };
    await deps.guardar(ticketId, fallo);
    return fallo;
  }
}
