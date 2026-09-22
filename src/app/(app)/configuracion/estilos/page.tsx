"use client";

import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { EstatusBadge, CategoriaBadge, ESTATUS_TONE } from "@/components/ui/badge";
import { useCategoriasStore } from "@/stores/categorias";
import { isAdminRole } from "@/types/user";

export default function EstilosPage() {
  const role = useAuthStore((s) => s.role);
  const categorias = useCategoriasStore((s) => s.categorias);

  if (!isAdminRole(role)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-center max-w-lg">
        <ShieldAlert className="h-6 w-6 text-danger" />
        <p className="text-sm font-medium">No tienes permiso para ver esta pagina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <p className="text-sm opacity-70">
        Referencia viva de tipografia, contraste y componentes base — util cuando se agreguen
        o ajusten pantallas nuevas, para no perder de vista lo ya definido.
      </p>

      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-80">Botones</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Guardar</Button>
          <Button variant="success">Aceptar</Button>
          <Button variant="danger">Cancelar</Button>
          <Button variant="warning">Marcar pendiente</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-80">Estatus del ticket</h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(ESTATUS_TONE).map((estatus) => (
            <EstatusBadge key={estatus} estatus={estatus} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-80">Categoria de servicio</h2>
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <CategoriaBadge key={c.id} categoria={c.nombre} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-80">Panel secundario (surface)</h2>
        <p className="text-sm mt-2">Texto sobre fondo surface, tambien calibrado a 10:1 de contraste.</p>
      </section>
    </div>
  );
}
