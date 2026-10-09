import { isAdminRole, LEGAL_STAFF_ROLES, type Role } from "@/types/user";
import type { Ticket } from "@/types/ticket";
import type { ResumenContratoTicket } from "@/types/resumen-contrato";
import { encontrarContrato, nombreDeUrl, resumenReintentable } from "./contrato-rules";
import { construirContenido, parsearExtraccion } from "./extraccion-rules";
import { calcularDiscrepancias } from "./discrepancias-rules";

export interface DepsResumen {
  cargarTicket(id: string): Promise<Ticket | null>;
  descargar(url: string): Promise<Buffer>;
  extraerTexto(buffer: Buffer): Promise<string>;
  llamarGemini(contenido: string): Promise<string>;
  guardar(ticketId: string, resumen: ResumenContratoTicket): Promise<void>;
  ahora(): Date;
}

const MENSAJE_ERROR = "No se pudo generar el resumen.";
const MIN_CARACTERES_UTILES = 50;

export class ValidacionResumenError extends Error {}

export function puedeGenerarResumen(actor: { uid: string; role: Role }, ticket: Ticket, ahora: Date = new Date()): { permitido: boolean; puedeElegirArchivo: boolean } {
  if (LEGAL_STAFF_ROLES.includes(actor.role) || isAdminRole(actor.role)) return { permitido: true, puedeElegirArchivo: true };
  const esDueno = actor.uid === ticket.solicitanteId;
  return { permitido: esDueno && resumenReintentable(ticket.resumenContrato, ahora), puedeElegirArchivo: false };
}

export async function generarResumenContrato(deps: DepsResumen, ticketId: string, archivoUrl?: string): Promise<ResumenContratoTicket> {
  const ticket = await deps.cargarTicket(ticketId);
  if (!ticket) throw new Error("Ticket no encontrado.");

  if (archivoUrl) {
    if (!ticket.documentacion.includes(archivoUrl)) throw new ValidacionResumenError("El archivo no pertenece al ticket.");
    if (!nombreDeUrl(archivoUrl).toLowerCase().endsWith(".docx")) throw new ValidacionResumenError("Solo se admiten archivos docx.");
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
    const texto = await deps.extraerTexto(await deps.descargar(url));
    if (texto.trim().length < MIN_CARACTERES_UTILES) throw new Error("El docx no contiene texto util.");

    const parseada = parsearExtraccion(await deps.llamarGemini(construirContenido(texto)));
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
