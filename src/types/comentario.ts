import type { Role } from "./user";

export type TipoComentario = "comentario" | "cambios_solicitados";

// Documento tickets/{ticketId}/comentarios/{comentarioId}. "cambios_solicitados" solo lo crea el servidor.
export interface NuevoComentario {
  autorUid: string;
  autorNombre: string;
  autorRol: Role;
  texto: string | null; // null cuando esta eliminado (borrado logico)
  tipo: TipoComentario;
  creadoEn: string; // ISO
  editadoEn?: string; // ISO
  eliminado: boolean;
  // Solo lo escribe el servidor (Admin SDK) al mandar los avisos: evita avisos repetidos.
  avisoEnviado?: boolean;
}

export interface Comentario extends NuevoComentario {
  id: string;
}
