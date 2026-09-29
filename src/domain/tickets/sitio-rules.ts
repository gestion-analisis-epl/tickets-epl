import { SERVICIOS_ARRENDAMIENTO_IDS } from "@/lib/data/arrendamientos-temporal";
import { isAdminRole, type Role } from "@/types/user";
import type { SitioArrendamiento, Ticket } from "@/types/ticket";

// Asignar el sitio a un ticket existente (los previos al selector tienen texto libre):
// solo Mesa de Control y admins, y solo en tickets de arrendamiento.
export function puedeActualizarSitio(role: Role | null | undefined, ticket: Pick<Ticket, "servicioId">): boolean {
  if (!SERVICIOS_ARRENDAMIENTO_IDS.includes(ticket.servicioId)) return false;
  return role === "mesa_control" || isAdminRole(role);
}

export function calcularPatchSitio(sitio: SitioArrendamiento, actorUid: string, ahora: Date): Partial<Ticket> {
  return {
    sitioArrendamiento: { clave: sitio.clave, alias: sitio.alias },
    sitioActualizadoPor: actorUid,
    sitioActualizadoEn: ahora.toISOString(),
  };
}
