"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useCatalogoStore } from "@/stores/catalogo";
import { CatalogoTable } from "@/components/catalogo/catalogo-table";
import { CategoriasPanel } from "@/components/catalogo/categorias-panel";

export default function CatalogoPage() {
  const role = useAuthStore((s) => s.role);
  const puedeVer = role === "mesa_control" || role === "abogado" || role === "gerente_juridico" || role === "admin";
  const servicios = useCatalogoStore((s) => s.servicios);
  const loaded = useCatalogoStore((s) => s.loaded);

  if (!puedeVer) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-center max-w-lg">
          <ShieldAlert className="h-6 w-6 text-danger" />
          <p className="text-sm font-medium">No tienes permiso para ver esta pagina.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Catalogo de servicios</h1>
        <p className="text-sm mt-1 opacity-70">
          Los {servicios.length} servicios estandarizados del area Legal, con su puesto responsable y SLA.
        </p>
      </div>
      {loaded ? (
        <>
          <CategoriasPanel servicios={servicios} />
          <CatalogoTable data={servicios} />
        </>
      ) : (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-5 w-5 animate-spin opacity-50" />
        </div>
      )}
    </div>
  );
}
