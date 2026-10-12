"use client";

import { Loader2 } from "lucide-react";
import { useHistorial } from "@/hooks/use-historial";
import { ETIQUETA_TIPO_HISTORIAL, lineaDeTiempo } from "@/domain/tickets/historial-rules";
import { formatFecha } from "@/lib/format-fecha";
import type { Ticket } from "@/types/ticket";

// Solo texto plano: los valores (incluido el texto de comentarios editados) se pintan como texto de React.
export function HistorialPanel({ ticket }: { ticket: Ticket }) {
  const { entradas, loading, error } = useHistorial(ticket.id);
  const items = lineaDeTiempo(entradas, ticket.historialEstatus ?? []);

  return (
    <section className="section-card p-6 space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:space-y-0 lg:gap-4">
      <h2 className="eyebrow shrink-0">Historial</h2>

      {loading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">No se pudo cargar el historial.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Sin cambios registrados.</p>
      ) : (
        <ol className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          {items.map((item) =>
            item.origen === "historial" ? (
              <li key={item.entrada.id} className="border-l-2 border-border pl-3">
                <p className="text-xs text-muted">
                  {formatFecha(item.fecha, { conHora: true })} · {item.entrada.actorNombre || "Sin nombre"}
                </p>
                <p className="text-sm font-medium">{ETIQUETA_TIPO_HISTORIAL[item.entrada.tipo] ?? item.entrada.tipo}</p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {item.entrada.cambios.map((c) => (
                    <li key={c.campo} className="whitespace-pre-wrap break-words">
                      <span className="text-muted">{c.etiqueta}:</span> {c.antes ?? "—"} → {c.despues ?? "—"}
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={`estatus-${item.fecha}-${item.estatus}`} className="border-l-2 border-border pl-3">
                <p className="text-xs text-muted">{formatFecha(item.fecha, { conHora: true })}</p>
                <p className="text-sm font-medium">Cambio de estatus</p>
                <p className="text-sm">
                  {item.estatus} <span className="text-muted">(registro previo, sin detalle)</span>
                </p>
              </li>
            )
          )}
        </ol>
      )}
    </section>
  );
}
