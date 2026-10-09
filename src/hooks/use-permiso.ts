"use client";

import { useAuthStore } from "@/stores/auth";
import { tienePermiso, type Permiso } from "@/domain/users/permisos";

// Solo para mostrar u ocultar controles: la autoridad real son firestore.rules y las rutas API.
export function usePermiso(permiso: Permiso): boolean {
  const role = useAuthStore((s) => s.role);
  const permisos = useAuthStore((s) => s.permisos);
  return tienePermiso({ role, permisos }, permiso);
}
