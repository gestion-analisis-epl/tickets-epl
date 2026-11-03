import { isAdminRole, type Role } from "@/types/user";

// Quien puede cambiar a mano el nombre visible de un adjunto: admin (incluye gerente juridico) y abogado.
export function puedeEditarEtiquetas(role: Role | null | undefined): boolean {
  return isAdminRole(role) || role === "abogado";
}
