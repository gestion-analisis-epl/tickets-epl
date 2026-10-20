import { SERVICIOS_ARRENDAMIENTO_IDS } from "@/lib/data/arrendamientos-temporal";
import { isAdminRole, type Role } from "@/types/user";
import type { SitioArrendamiento, Ticket } from "@/types/ticket";

// Asignar el sitio a un ticket existente (los previos al selector tienen texto libre):
// Mesa de Control, admins y el abogado asignado a ese ticket, y solo en tickets de arrendamiento.
export function puedeActualizarSitio(
  role: Role | null | undefined,
  ticket: Pick<Ticket, "servicioId"> & Partial<Pick<Ticket, "abogadoAsignadoId">>,
  abogadoId?: string | null
): boolean {
  if (!SERVICIOS_ARRENDAMIENTO_IDS.includes(ticket.servicioId)) return false;
  if (role === "abogado") return !!abogadoId && abogadoId === ticket.abogadoAsignadoId;
  return role === "mesa_control" || isAdminRole(role);
}

export function calcularPatchSitio(sitio: SitioArrendamiento, actorUid: string, ahora: Date): Partial<Ticket> {
  return {
    sitioArrendamiento: { clave: sitio.clave, alias: sitio.alias },
    sitioActualizadoPor: actorUid,
    sitioActualizadoEn: ahora.toISOString(),
  };
}
