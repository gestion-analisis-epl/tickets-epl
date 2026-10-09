import type { Role } from "./user";

export const TIPOS_HISTORIAL = [
  "estatus",
  "asignacion",
  "solicitud",
  "documentos",
  "sitio",
  "exclusion",
  "notas_cierre",
  "visto_bueno",
  "cambios_solicitados",
  "comentario_editado",
  "comentario_eliminado",
] as const;

export type TipoHistorial = (typeof TIPOS_HISTORIAL)[number];

// Valores ya convertidos a texto legible (ver historial-rules.ts textoDeValor).
export interface CambioCampo {
  campo: string;
  etiqueta: string;
  antes: string | null;
  despues: string | null;
}

export interface ActorHistorial {
  uid: string;
  nombre: string;
  rol: Role;
}

// Documento tickets/{ticketId}/historial/{entradaId}. Solo se agrega: las reglas niegan update/delete.
// Es aparte de ticket.historialEstatus, que sigue alimentando el SLA (sla-pausa-rules.ts).
export interface EntradaHistorial {
  fecha: string; // ISO
  actorUid: string;
  actorNombre: string;
  actorRol: Role;
  tipo: TipoHistorial;
  cambios: CambioCampo[];
  // Solo comentario_editado, comentario_eliminado y cambios_solicitados (Plan D). Se omite la clave si no aplica:
  // el SDK de cliente rechaza valores undefined.
  comentarioId?: string;
}

export interface EntradaHistorialGuardada extends EntradaHistorial {
  id: string;
}
