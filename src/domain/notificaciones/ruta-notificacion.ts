import { esJefeZona, type Role } from "@/types/user";

// El jefe de zona no abre /tickets (no lee esa coleccion): sus avisos llevan a /pre-cierre.
export function rutaNotificacion(role: Role | null | undefined, ticketId: string): string {
  return esJefeZona(role) ? `/pre-cierre/${ticketId}` : `/tickets/${ticketId}`;
}
