import type { Role } from "./user";

// De dónde viene el archivo dentro del ticket. Sincronizar a mano con firestore.rules (tickets/{id}/archivos).
export const ORIGENES_ARCHIVO = [
  "documentacion",
  "formato_arrendamiento",
  "documento_arrendamiento",
  "alta",
  "revision_legal",
] as const;

export type OrigenArchivo = (typeof ORIGENES_ARCHIVO)[number];
export type AccionArchivo = "subido" | "eliminado";

// Documento tickets/{ticketId}/archivos/{archivoId}. Solo se agrega: las reglas niegan update/delete.
// Nunca lleva la URL de descarga (tiene token): la llave para unirlo con una URL es `ruta`.
export interface RegistroArchivo {
  nombre: string;
  ruta: string; // ruta del objeto en Storage, p. ej. "tickets/abc/1700000000_Predial.pdf"
  origen: OrigenArchivo;
  // Campo concreto cuando aplica (clave del documento de Alta, campo de la revisión legal). Se omite si no aplica:
  // el SDK de cliente rechaza valores undefined.
  campo?: string;
  accion: AccionArchivo;
  fecha: string; // ISO
  actorUid: string;
  actorNombre: string;
  actorRol: Role;
}

export interface RegistroArchivoGuardado extends RegistroArchivo {
  id: string;
}
