import type { EtiquetaDocumento, Ticket } from "@/types/ticket";
import { nombreDeUrl } from "./nombre-url";

export const ETIQUETA_SIN_IDENTIFICAR = "Documento sin identificar";
export const MAX_CARACTERES_ETIQUETA = 60;
export const MAX_BYTES_IMAGEN_ETIQUETA = 10 * 1024 * 1024;

// Palabras que, solas o combinadas con numeros/fechas, delatan un nombre puesto por el celular o la app
// (IMG_5212, PHOTO-2026-09-18-08-35-08, WhatsApp Image 2026-09-18 at 08.35.08, scan_001...).
const PALABRAS_GENERICAS = new Set([
  "img", "image", "imagen", "photo", "foto", "dsc", "dscn", "pxl", "mvimg", "pic", "picture", "screenshot", "captura", "pantalla",
  "de", "scan", "scanned", "escaneo", "escaneado", "whatsapp", "wa", "archivo", "documento", "doc", "camera", "cam", "at", "a", "las",
  "copy", "copia", "rw", "unnamed", "download", "file", "video",
]);

export function esNombreGenerico(nombre: string): boolean {
  const base = nombre.replace(/\.[a-z0-9]+$/i, "");
  const palabras = base.toLowerCase().split(/[^a-záéíóúüñ]+/).filter(Boolean);
  return palabras.every((p) => PALABRAS_GENERICAS.has(p));
}

const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf",
};

// Lo que Gemini sabe leer como imagen o PDF; null = no se etiqueta.
export function mimeEtiquetable(nombre: string): string | null {
  const ext = nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && MIME_POR_EXTENSION[ext]) || null;
}

export function limpiarEtiqueta(texto: string): string {
  return texto.replace(/[\r\n\t]+/g, " ").replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, MAX_CARACTERES_ETIQUETA).trim();
}

// Adjuntos con nombre generico, legibles por la IA y que aun no tienen etiqueta (ni de la IA ni a mano).
export function adjuntosSinEtiqueta(ticket: Pick<Ticket, "documentacion" | "etiquetasDocumentos">): string[] {
  const hechos = new Set((ticket.etiquetasDocumentos ?? []).map((e) => e.url));
  return (ticket.documentacion ?? []).filter((url) => {
    const nombre = nombreDeUrl(url);
    return !hechos.has(url) && esNombreGenerico(nombre) && mimeEtiquetable(nombre) !== null;
  });
}

// Texto que se muestra en lugar del nombre del archivo.
export function etiquetaDeAdjunto(ticket: Pick<Ticket, "etiquetasDocumentos">, url: string): string {
  const e = (ticket.etiquetasDocumentos ?? []).find((x) => x.url === url);
  if (e) return e.sinIdentificar ? ETIQUETA_SIN_IDENTIFICAR : e.etiqueta;
  return nombreDeUrl(url) || "Documento adjunto";
}

export function sinIdentificarDelTicket(ticket: Pick<Ticket, "etiquetasDocumentos">): EtiquetaDocumento[] {
  return (ticket.etiquetasDocumentos ?? []).filter((e) => e.sinIdentificar);
}

// Reemplaza (o agrega) la etiqueta de una URL; etiqueta vacia la quita para volver al nombre original.
export function aplicarEtiqueta(actuales: EtiquetaDocumento[] | undefined, nueva: { url: string; etiqueta: string; origen: "ia" | "manual"; sinIdentificar?: boolean }): EtiquetaDocumento[] {
  const resto = (actuales ?? []).filter((e) => e.url !== nueva.url);
  const etiqueta = limpiarEtiqueta(nueva.etiqueta);
  if (!etiqueta && !nueva.sinIdentificar) return resto;
  return [...resto, { url: nueva.url, etiqueta, origen: nueva.origen, ...(nueva.sinIdentificar ? { sinIdentificar: true } : {}) }];
}

// Nombre dentro del ZIP: la etiqueta mas la extension original.
export function nombreParaZip(etiqueta: string, nombreOriginal: string): string {
  const ext = nombreOriginal.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  return `${limpiarEtiqueta(etiqueta).replace(/[<>:"|?*]/g, "")}${ext}`;
}
