"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { KpiDrawer } from "@/components/dashboard/kpi-drawer";
import { BarList } from "@/components/dashboard/bar-list";
import { useTickets } from "@/hooks/use-tickets";
import { computeDashboardStats, type KpiKey } from "@/lib/dashboard-stats";
import { useCategoriasStore } from "@/stores/categorias";

const CHART_VARS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)"];

function slaStatus(pct: number | null): { color: "good" | "warning" | "critical"; label: string } | undefined {
  if (pct == null) return undefined;
  if (pct >= 90) return { color: "good", label: "En cumplimiento" };
  if (pct >= 70) return { color: "warning", label: "Atencion requerida" };
  return { color: "critical", label: "Por debajo del objetivo" };
}

export default function DashboardPage() {
  const { tickets, loading } = useTickets();
  const categorias = useCategoriasStore((s) => s.categorias);
  const [kpi, setKpi] = useState<KpiKey | null>(null);
  const stats = computeDashboardStats(tickets, categorias.map((c) => c.nombre));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="page-rule text-3xl font-semibold">Dashboard</h1>
        <p className="text-sm mt-1 text-muted">Carga de trabajo y cumplimiento de SLA del area Legal, al momento.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total de tickets" value={stats.total} onClick={() => setKpi("total")} active={kpi === "total"} />
        <StatTile label="Activos (no cerrados)" value={stats.activos} onClick={() => setKpi("activos")} active={kpi === "activos"} />
        <StatTile
          label="Cumplimiento de SLA"
          value={stats.cumplimientoSLA != null ? `${stats.cumplimientoSLA}%` : "—"}
          status={slaStatus(stats.cumplimientoSLA)}
          onClick={() => setKpi("sla")}
          active={kpi === "sla"}
        />
        <StatTile
          label="Satisfaccion promedio"
          value={stats.satisfaccionPromedio != null ? `${stats.satisfaccionPromedio} / 10` : "—"}
          onClick={() => setKpi("satisfaccion")}
          active={kpi === "satisfaccion"}
        />
      </div>
      <KpiDrawer kpi={kpi} tickets={tickets} onClose={() => setKpi(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="section-card p-6">
          <h2 className="eyebrow mb-4">Tickets por estatus</h2>
          <BarList
            items={stats.porEstatus.map((item, i) => ({ ...item, color: CHART_VARS[i % CHART_VARS.length] }))}
          />
        </section>

        <section className="section-card p-6">
          <h2 className="eyebrow mb-4">Tickets por categoria</h2>
          <BarList
            items={stats.porCategoria.map((item, i) => ({ ...item, color: CHART_VARS[i % CHART_VARS.length] }))}
          />
        </section>
      </div>

      <section className="section-card p-6">
        <h2 className="eyebrow mb-4">Carga por abogado</h2>
        {stats.porAbogado.length > 0 ? (
          <BarList items={stats.porAbogado.map((item) => ({ ...item, color: "hsl(var(--primary))" }))} />
        ) : (
          <p className="text-sm text-muted">Sin tickets asignados todavia.</p>
        )}
      </section>
      </>
      )}
    </div>
  );
}
