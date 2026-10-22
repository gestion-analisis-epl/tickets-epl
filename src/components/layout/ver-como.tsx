"use client";

import { Eye, X } from "lucide-react";
import { useAuthStore, type Role } from "@/stores/auth";

const ROLES_SIMULABLES: { rol: Role; etiqueta: string }[] = [
  { rol: "solicitante", etiqueta: "Solicitante" },
  { rol: "gerente_area", etiqueta: "Gerente de area" },
  { rol: "mesa_control", etiqueta: "Mesa de control" },
  { rol: "abogado", etiqueta: "Abogado" },
  { rol: "gerente_juridico", etiqueta: "Gerente juridico" },
  { rol: "jefe_zona", etiqueta: "Jefe de zona" },
  { rol: "sitios", etiqueta: "Sitios" },
];

export function etiquetaRol(rol: Role): string {
  return ROLES_SIMULABLES.find((r) => r.rol === rol)?.etiqueta ?? rol;
}

// Solo UI: las consultas y las reglas de Firestore siguen usando la cuenta real del admin.
export function VerComoSelector() {
  const roleReal = useAuthStore((s) => s.roleReal);
  const verComo = useAuthStore((s) => s.verComo);
  const setVerComo = useAuthStore((s) => s.setVerComo);

  if (roleReal !== "admin") return null;

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <Eye className="h-4 w-4" />
      <span className="hidden sm:inline">Ver como</span>
      <select
        value={verComo ?? ""}
        onChange={(e) => setVerComo((e.target.value || null) as Role | null)}
        className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
      >
        <option value="">Administrador</option>
        {ROLES_SIMULABLES.map((r) => (
          <option key={r.rol} value={r.rol}>{r.etiqueta}</option>
        ))}
      </select>
    </label>
  );
}

export function VerComoBanner() {
  const verComo = useAuthStore((s) => s.verComo);
  const setVerComo = useAuthStore((s) => s.setVerComo);

  if (!verComo) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-warning px-4 py-1.5 text-xs font-medium text-black">
      <span>Simulando la vista de: {etiquetaRol(verComo)}. Tu cuenta y tus permisos reales no cambian.</span>
      <button
        type="button"
        onClick={() => setVerComo(null)}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 underline hover:bg-black/10"
      >
        <X className="h-3 w-3" /> Salir
      </button>
    </div>
  );
}
