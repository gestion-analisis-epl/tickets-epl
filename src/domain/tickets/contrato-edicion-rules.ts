import { isAdminRole, type Role } from "@/types/user";
import type { ContratoArrendamientoInput, Ticket } from "@/types/ticket";
import { bloqueadoPorPreCierre, solicitudEditable } from "./etapa-permisos-rules";
import { SERVICIOS_CON_DATOS_CONTRATO_IDS } from "@/lib/data/arrendamientos-temporal";

// Sin "sitio" (se edita con su propio selector) ni "notas" (ya no se capturan).
export type ContratoEdicionInput = Omit<ContratoArrendamientoInput, "sitio" | "notas">;

export function requiereDatosContrato(servicioId: string | null | undefined): boolean {
  return !!servicioId && SERVICIOS_CON_DATOS_CONTRATO_IDS.includes(servicioId);
}

// Admin/Gerente Juridico y el abogado asignado a ESTE ticket. Editar datos ya capturados: solo antes de Pre-Cierre.
// Completar los que nunca se capturaron (tickets anteriores al formulario): tambien una vez cerrado el ticket.
export function puedeEditarContrato(
  sesion: { role: Role | null | undefined; abogadoId: string | null | undefined },
  ticket: Pick<Ticket, "abogadoAsignadoId" | "estatus" | "contratoArrendamiento"> & Partial<Pick<Ticket, "servicioId">>
): boolean {
  if (ticket.contratoArrendamiento) {
    if (!solicitudEditable(ticket.estatus)) return false;
  } else if (!requiereDatosContrato(ticket.servicioId) || bloqueadoPorPreCierre(ticket.estatus)) {
    return false;
  }
  if (isAdminRole(sesion.role)) return true;
  return sesion.role === "abogado" && !!sesion.abogadoId && sesion.abogadoId === ticket.abogadoAsignadoId;
}

// Conserva lo que esta pantalla no edita (sitio de tickets previos, notas).
export function calcularPatchContrato(current: Ticket, input: ContratoEdicionInput): Partial<Ticket> {
  return { contratoArrendamiento: { ...current.contratoArrendamiento, ...input } };
}
