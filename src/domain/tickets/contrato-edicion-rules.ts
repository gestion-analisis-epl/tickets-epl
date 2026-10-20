import { isAdminRole, type Role } from "@/types/user";
import type { ContratoArrendamientoInput, Ticket } from "@/types/ticket";
import { solicitudEditable } from "./etapa-permisos-rules";

// Sin "sitio" (se edita con su propio selector) ni "notas" (ya no se capturan).
export type ContratoEdicionInput = Omit<ContratoArrendamientoInput, "sitio" | "notas">;

// Admin/Gerente Juridico y el abogado asignado a ESTE ticket; solo antes de Pre-Cierre.
export function puedeEditarContrato(
  sesion: { role: Role | null | undefined; abogadoId: string | null | undefined },
  ticket: Pick<Ticket, "abogadoAsignadoId" | "estatus" | "contratoArrendamiento">
): boolean {
  if (!ticket.contratoArrendamiento || !solicitudEditable(ticket.estatus)) return false;
  if (isAdminRole(sesion.role)) return true;
  return sesion.role === "abogado" && !!sesion.abogadoId && sesion.abogadoId === ticket.abogadoAsignadoId;
}

// Conserva lo que esta pantalla no edita (sitio de tickets previos, notas).
export function calcularPatchContrato(current: Ticket, input: ContratoEdicionInput): Partial<Ticket> {
  return { contratoArrendamiento: { ...current.contratoArrendamiento, ...input } };
}
