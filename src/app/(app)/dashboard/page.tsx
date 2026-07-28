"use client";

import { Loader2 } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { BarList } from "@/components/dashboard/bar-list";
import { useTickets } from "@/hooks/use-tickets";
import { computeDashboardStats } from "@/lib/dashboard-stats";

const CHART_VARS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)"];

function slaStatus(pct: number | null): { color: "good" | "warning" | "critical"; label: string } | undefined {
  if (pct == null) return undefined;
  if (pct >= 90) return { color: "good", label: "En cumplimiento" };
  if (pct >= 70) return { color: "warning", label: "Atencion requerida" };
  return { color: "critical", label: "Por debajo del objetivo" };
}

export default function DashboardPage() {
  const { tickets, loading } = useTickets();
  const stats = computeDashboardStats(tickets);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm mt-1 opacity-70">Datos en vivo desde Firestore.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-5 w-5 animate-spin opacity-50" />
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total de tickets" value={stats.total} />
        <StatTile label="Activos (no cerrados)" value={stats.activos} />
        <StatTile
          label="Cumplimiento de SLA"
          value={stats.cumplimientoSLA != null ? `${stats.cumplimientoSLA}%` : "—"}
          status={slaStatus(stats.cumplimientoSLA)}
        />
        <StatTile
          label="Satisfaccion promedio"
          value={stats.satisfaccionPromedio != null ? `${stats.satisfaccionPromedio} / 10` : "—"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-4">Tickets por estatus</h2>
          <BarList
            items={stats.porEstatus.map((item, i) => ({ ...item, color: CHART_VARS[i % CHART_VARS.length] }))}
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-4">Tickets por categoria</h2>
          <BarList
            items={stats.porCategoria.map((item, i) => ({ ...item, color: CHART_VARS[i % CHART_VARS.length] }))}
          />
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70 mb-4">Carga por abogado</h2>
        {stats.porAbogado.length > 0 ? (
          <BarList items={stats.porAbogado.map((item) => ({ ...item, color: "hsl(var(--primary))" }))} />
        ) : (
          <p className="text-sm opacity-50">Sin tickets asignados todavia.</p>
        )}
      </section>
      </>
      )}
    </div>
  );
}
