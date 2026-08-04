"use client";

import { useState } from "react";
import { ShieldAlert, Wrench } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { backfillSlaHistorico, type BackfillResultado } from "@/lib/tickets";
import { Button } from "@/components/ui/button";

export function MantenimientoPanel() {
  const role = useAuthStore((s) => s.role);
  const [confirmando, setConfirmando] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [resultado, setResultado] = useState<BackfillResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCorrer() {
    setCorriendo(true);
    setError(null);
    setResultado(null);
    try {
      const r = await backfillSlaHistorico();
      setResultado(r);
      setConfirmando(false);
    } catch {
      setError("No se pudo completar el recalculo. Intenta de nuevo.");
    } finally {
      setCorriendo(false);
    }
  }

  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-center max-w-lg">
        <ShieldAlert className="h-6 w-6 text-danger" />
        <p className="text-sm font-medium">No tienes permiso para ver esta pagina.</p>
        <p className="text-xs opacity-60">Solo cuentas con rol admin pueden usar herramientas de mantenimiento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <section className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Recalcular SLA historico</h2>
        <p className="text-sm opacity-80">
          Recalcula <span className="font-medium">nivel de servicio</span> y{" "}
          <span className="font-medium">dias en pipeline</span> de los tickets ya cerrados, usando la fecha de
          asignacion del abogado como inicio del SLA (antes se calculaba desde la fecha de solicitud). Los tickets
          abiertos no se ven afectados — se recalculan solos en cada lectura.
        </p>

        {!confirmando ? (
          <Button variant="warning" onClick={() => setConfirmando(true)}>
            <Wrench className="h-4 w-4" />
            Recalcular SLA historico
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              Esto sobrescribe <span className="font-medium">nivel de servicio</span>,{" "}
              <span className="font-medium">dias transcurridos</span> y{" "}
              <span className="font-medium">dias en pipeline</span> de todos los tickets ya cerrados. No se puede
              deshacer.
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button variant="warning" onClick={handleCorrer} disabled={corriendo}>
                {corriendo ? "Recalculando..." : "Si, recalcular"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmando(false)} disabled={corriendo}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {resultado && (
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {resultado.actualizados} tickets actualizados
            {resultado.omitidos > 0 && `, ${resultado.omitidos} omitidos (sin fechaSolicitud/fechaCierre)`}.
          </div>
        )}

        {resultado && resultado.detalles.length > 0 && (
          <details className="text-xs opacity-70">
            <summary className="cursor-pointer select-none">Ver detalle por ticket</summary>
            <ul className="mt-2 space-y-0.5 max-h-64 overflow-y-auto font-mono">
              {resultado.detalles.map((linea, i) => (
                <li key={i}>{linea}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
