import { isAdminRole, LEGAL_STAFF_ROLES, esRolSoloResumen, type Role } from "@/types/user";
import type { Ticket } from "@/types/ticket";
import type { ResumenContratoTicket } from "@/types/resumen-contrato";
import { encontrarContrato, nombreDeUrl, resumenReintentable } from "./contrato-rules";
import { tipoContrato, type TipoContrato } from "./tipo-archivo";
import { construirContenido, parsearExtraccion } from "./extraccion-rules";
import { calcularDiscrepancias } from "./discrepancias-rules";
import { ticketLlegoAPreCierreOCierre } from "./backfill-rules";

export type ContenidoGemini = { tipo: "texto"; texto: string } | { tipo: "pdf"; base64: string };

export interface DepsResumen {
  cargarTicket(id: string): Promise<Ticket | null>;
  descargar(url: string): Promise<Buffer>;
  // docx: texto extraido; pdf: el PDF en base64 (Gemini lo lee directamente).
  prepararContenido(buffer: Buffer, tipo: TipoContrato): Promise<ContenidoGemini>;
  llamarGemini(contenido: ContenidoGemini): Promise<string>;
  guardar(ticketId: string, resumen: ResumenContratoTicket): Promise<void>;
  ahora(): Date;
}

const MENSAJE_ERROR = "No se pudo generar el resumen.";
const MIN_CARACTERES_UTILES = 50;

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
    if (!ticket.documentacion.includes(archivoUrl)) throw new ValidacionResumenError("El archivo no pertenece al ticket.");
    if (!tipoContrato(nombreDeUrl(archivoUrl))) throw new ValidacionResumenError("Solo se admiten archivos docx o pdf.");
  }
  const url = archivoUrl ?? encontrarContrato(ticket.documentacion);

  if (!url) {
    const sinContrato: ResumenContratoTicket = {
      estado: "sin_contrato", extraccion: null, discrepancias: [], contratoNombre: null, contratoUrl: null, generadoEn: deps.ahora().toISOString(),
    };
    await deps.guardar(ticketId, sinContrato);
    return sinContrato;
  }

  const contratoNombre = nombreDeUrl(url);
  await deps.guardar(ticketId, {
    estado: "pendiente", extraccion: null, discrepancias: [], contratoNombre, contratoUrl: url, generadoEn: null, solicitadoEn: deps.ahora().toISOString(),
  });

  try {
    const tipo = tipoContrato(contratoNombre);
    if (!tipo) throw new Error("Tipo de archivo no admitido.");
    const preparado = await deps.prepararContenido(await deps.descargar(url), tipo);
    let contenido: ContenidoGemini = preparado;
    if (preparado.tipo === "texto") {
      if (preparado.texto.trim().length < MIN_CARACTERES_UTILES) throw new Error("El docx no contiene texto util.");
      contenido = { tipo: "texto", texto: construirContenido(preparado.texto) };
    }

    const parseada = parsearExtraccion(await deps.llamarGemini(contenido));
    if (!parseada.ok) throw new Error(parseada.error);

    const listo: ResumenContratoTicket = {
      estado: "listo",
      extraccion: parseada.extraccion,
      discrepancias: calcularDiscrepancias(ticket, parseada.extraccion),
      contratoNombre,
      contratoUrl: url,
      generadoEn: deps.ahora().toISOString(),
    };
    await deps.guardar(ticketId, listo);
    return listo;
  } catch (err) {
    console.error(`Resumen de contrato fallo (ticket ${ticketId}):`, err instanceof Error ? err.message : "error desconocido");
    const fallo: ResumenContratoTicket = {
      estado: "error", extraccion: null, discrepancias: [], contratoNombre, contratoUrl: url, generadoEn: deps.ahora().toISOString(), error: MENSAJE_ERROR,
    };
    await deps.guardar(ticketId, fallo);
    return fallo;
  }
}
