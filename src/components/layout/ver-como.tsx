"use client";

import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { listUsers, type UserRow } from "@/lib/users";
import { useRouter } from "next/navigation";
import { ETAPAS_EJEMPLO, SERVICIOS_EJEMPLO } from "@/domain/tickets/ticket-ejemplo";
import type { Estatus } from "@/types/ticket";
import { useAuthStore, puedeVerComo, type Role } from "@/stores/auth";

const ROLES_SIMULABLES: { rol: Role; etiqueta: string }[] = [
  { rol: "solicitante", etiqueta: "Solicitante" },
  { rol: "gerente_area", etiqueta: "Gerente de area" },
  { rol: "gerente_sitios", etiqueta: "Gerente de sitios" },
  { rol: "mesa_control", etiqueta: "Mesa de control" },
  { rol: "abogado", etiqueta: "Abogado" },
  { rol: "gerente_juridico", etiqueta: "Gerente juridico" },
  { rol: "jefe_zona", etiqueta: "Jefe de zona" },
  { rol: "sitios", etiqueta: "Sitios" },
];

export function etiquetaRol(rol: Role): string {
  return ROLES_SIMULABLES.find((r) => r.rol === rol)?.etiqueta ?? rol;
}

// Elige a que gerente se simula: se muestran los tickets de su equipo (filtrados en pantalla).
function SelectorGerente({ rol }: { rol: "gerente_area" | "gerente_sitios" }) {
  const verComoGerente = useAuthStore((s) => s.verComoGerente);
  const setVerComoGerente = useAuthStore((s) => s.setVerComoGerente);
  const [gerentes, setGerentes] = useState<UserRow[]>([]);

  useEffect(() => {
    let vigente = true;
    listUsers()
      .then((usuarios) => {
        if (vigente) setGerentes(usuarios.filter((u) => u.role === rol && u.activo));
      })
      .catch(() => {
        if (vigente) setGerentes([]);
      });
    return () => {
      vigente = false;
    };
  }, [rol]);

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="hidden sm:inline">Gerente</span>
      <select
        value={verComoGerente?.uid ?? ""}
        onChange={(e) => {
          const g = gerentes.find((u) => u.uid === e.target.value);
          setVerComoGerente(g ? { uid: g.uid, nombre: g.nombre, supervisaUids: g.supervisaUids ?? [] } : null);
        }}
        className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
      >
        <option value="">Elige un gerente</option>
        {gerentes.map((g) => (
          <option key={g.uid} value={g.uid}>{g.nombre}</option>
        ))}
      </select>
    </label>
  );
}

// Solo UI: las consultas y las reglas de Firestore siguen usando la cuenta real del admin.
export function VerComoSelector() {
  const roleReal = useAuthStore((s) => s.roleReal);
  const verComo = useAuthStore((s) => s.verComo);
  const setVerComo = useAuthStore((s) => s.setVerComo);
  const etapaEjemplo = useAuthStore((s) => s.etapaEjemplo);
  const setEtapaEjemplo = useAuthStore((s) => s.setEtapaEjemplo);
  const servicioEjemplo = useAuthStore((s) => s.servicioEjemplo);
  const setServicioEjemplo = useAuthStore((s) => s.setServicioEjemplo);
  const router = useRouter();

  if (!puedeVerComo(roleReal)) return null;

  function elegirEtapa(valor: string) {
    const etapa = (valor || null) as Estatus | null;
    setEtapaEjemplo(etapa);
    router.push(etapa ? "/tickets/ejemplo" : "/tickets");
  }

  return (
    <div className="flex items-center gap-3">
    <label className="flex items-center gap-2 text-xs text-muted">
      <Eye className="h-4 w-4" />
      <span className="hidden sm:inline">Ver como</span>
      <select
        value={verComo ?? ""}
        onChange={(e) => setVerComo((e.target.value || null) as Role | null)}
        className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
      >
        <option value="">{roleReal === "admin" ? "Administrador" : "Mi vista (Gerente juridico)"}</option>
        {ROLES_SIMULABLES.filter((r) => r.rol !== roleReal).map((r) => (
          <option key={r.rol} value={r.rol}>{r.etiqueta}</option>
        ))}
      </select>
    </label>
    {(verComo === "gerente_area" || verComo === "gerente_sitios") && <SelectorGerente rol={verComo} />}
    {verComo === "abogado" && (
      <>
      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="hidden sm:inline">Servicio</span>
        <select
          value={servicioEjemplo}
          onChange={(e) => setServicioEjemplo(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
        >
          {SERVICIOS_EJEMPLO.map((s) => (
            <option key={s.servicioId} value={s.servicioId}>{s.etiqueta}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="hidden sm:inline">Ejemplo de ticket</span>
        <select
          value={etapaEjemplo ?? ""}
          onChange={(e) => elegirEtapa(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
        >
          <option value="">Sin ejemplo</option>
          {ETAPAS_EJEMPLO.map((e) => (
            <option key={e.etapa} value={e.etapa}>{e.etiqueta}</option>
          ))}
        </select>
      </label>
      </>
    )}
    </div>
  );
}

export function VerComoBanner() {
  const verComo = useAuthStore((s) => s.verComo);
  const setVerComo = useAuthStore((s) => s.setVerComo);
  const verComoGerente = useAuthStore((s) => s.verComoGerente);

  if (!verComo) return null;
  const esGerente = verComo === "gerente_area" || verComo === "gerente_sitios";

  return (
    <div className="flex items-center justify-center gap-3 bg-warning px-4 py-1.5 text-xs font-medium text-black">
      <span>
        Simulando la vista de: {etiquetaRol(verComo)}
        {esGerente && (verComoGerente ? ` (${verComoGerente.nombre})` : ". Elige un gerente arriba para ver los tickets de su equipo")}. Tu cuenta y tus permisos reales no cambian.
      </span>
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
