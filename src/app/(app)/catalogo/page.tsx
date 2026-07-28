"use client";

import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { CatalogoTable } from "@/components/catalogo/catalogo-table";
import { CATALOGO_SERVICIOS } from "@/lib/data/catalogo-servicios";

export default function CatalogoPage() {
  const role = useAuthStore((s) => s.role);
  const puedeVer = role === "mesa_control" || role === "abogado" || role === "gerente_juridico" || role === "admin";

  if (!puedeVer) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-center max-w-lg">
          <ShieldAlert className="h-6 w-6 text-danger" />
          <p className="text-sm font-medium">No tienes permiso para ver esta pagina.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Catalogo de servicios</h1>
        <p className="text-sm mt-1 opacity-70">
          Los {CATALOGO_SERVICIOS.length} servicios estandarizados del area Legal, con su puesto responsable y SLA.
        </p>
      </div>
      <CatalogoTable data={CATALOGO_SERVICIOS} />
    </div>
  );
}
