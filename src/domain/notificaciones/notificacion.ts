import type { Role } from "@/types/user";

export type TipoNotificacion =
  | "nuevo_ticket" | "asignacion" | "cambio_estatus" | "cierre"
  | "creacion_solicitante" | "asignacion_solicitante";

export interface Notificacion {
  id: string;
  ticketId: string;
  ticketFolio: string;
  tipo: TipoNotificacion;
  mensaje: string;
  fecha: string; // ISO
  paraUid: string | null;   // notificacion dirigida a una persona (solicitante, abogado asignado)
  paraRoles: Role[] | null; // notificacion dirigida a un conjunto de roles (ej. todo Legal)
  leidoPor: string[];
}

export interface NuevaNotificacionInput {
  ticketId: string;
  ticketFolio: string;
  tipo: TipoNotificacion;
  mensaje: string;
  paraUid: string | null;
  paraRoles: Role[] | null;
}
