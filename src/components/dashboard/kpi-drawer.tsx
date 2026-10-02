"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Ticket } from "@/types/ticket";
import { findAbogado } from "@/lib/data/abogados";
import { ticketsParaKpi, type KpiKey } from "@/lib/dashboard-stats";

const TITULOS: Record<KpiKey, { titulo: string; ayuda: string; vacio: string }> = {
  total: {
    titulo: "Total de tickets",
    ayuda: "Todos los tickets, los mas recientes primero.",
    vacio: "Todavia no hay tickets.",
  },
  activos: {
    titulo: "Tickets activos",
    ayuda: "Tickets no cerrados, los mas antiguos primero.",
    vacio: "No hay tickets activos.",
  },
  sla: {
    titulo: "Cumplimiento de SLA",
    ayuda: "Tickets cerrados con SLA calculado. Los incumplidos aparecen primero.",
    vacio: "Aun no hay tickets cerrados con SLA calculado.",
  },
  satisfaccion: {
    titulo: "Satisfaccion",
    ayuda: "Tickets calificados, de menor a mayor nota.",
    vacio: "Aun no hay tickets calificados.",
  },
};

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function dato(kpi: KpiKey, t: Ticket): string | null {
  if (kpi === "sla" && t.nivelServicio != null) {
    return t.nivelServicio >= 0 ? `Cumplio (+${t.nivelServicio} d)` : `Incumplio (${t.nivelServicio} d)`;
  }
  if (kpi === "satisfaccion" && t.satisfaccion != null) return `Nota ${t.satisfaccion}/10`;
  return null;
}

interface Props {
  kpi: KpiKey | null;
  tickets: Ticket[];
  onClose: () => void;
}

export function KpiDrawer({ kpi, tickets, onClose }: Props) {
  useEffect(() => {
    if (!kpi) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kpi, onClose]);

  if (!kpi) return null;
  const { titulo, ayuda, vacio } = TITULOS[kpi];
  const lista = ticketsParaKpi(tickets, kpi);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="font-display text-xl font-semibold">{titulo}</h2>
            <p className="mt-1 text-sm text-muted">
              {ayuda} <span className="tabular-nums">({lista.length})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            autoFocus
            className="rounded-md p-1.5 text-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {lista.length === 0 ? (
            <p className="p-5 text-sm text-muted">{vacio}</p>
          ) : (
            <ul className="divide-y divide-border">
              {lista.map((t) => {
                const extra = dato(kpi, t);
                return (
                  <li key={t.id}>
                    <Link href={`/tickets/${t.id}`} className="block p-4 hover:bg-border/30">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-display font-semibold tabular-nums text-primary">{t.folio}</span>
                        <span className="text-xs text-muted">{fecha(t.fechaSolicitud)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm">{t.descripcion}</p>
                      <p className="mt-1.5 text-xs text-muted">
                        {t.estatus}
                        {t.abogadoAsignadoId && ` · ${findAbogado(t.abogadoAsignadoId)?.nombre ?? t.abogadoAsignadoId}`}
                        {extra && <span className="font-semibold text-foreground"> · {extra}</span>}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
