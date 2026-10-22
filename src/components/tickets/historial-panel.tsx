"use client";

import type { CSSProperties } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useHistorial } from "@/hooks/use-historial";
import { ETIQUETA_TIPO_HISTORIAL, lineaDeTiempo } from "@/domain/tickets/historial-rules";
import { etiquetaRol, tokenColorRol } from "@/domain/tickets/rol-presentacion";
import { formatFechaHora, textoLegibleDeValor } from "@/lib/format-fecha";
import type { Ticket } from "@/types/ticket";

// Cada rol pinta su nodo, filete y etiqueta con su token --rol-* (ver globals.css).
function estiloRol(rol: string): CSSProperties {
  return { "--c": `var(--${tokenColorRol(rol)})` } as CSSProperties;
}

function EtiquetaRol({ rol }: { rol: string }) {
  return (
    <span
      style={estiloRol(rol)}
      className="inline-flex items-center rounded-full bg-[hsl(var(--c)/0.14)] px-2 py-0.5 text-[11px] font-semibold leading-none text-[hsl(var(--c))] ring-1 ring-inset ring-[hsl(var(--c)/0.35)]"
    >
      {etiquetaRol(rol)}
    </span>
  );
}

function Valor({ valor, nuevo }: { valor: string | null; nuevo?: boolean }) {
  const texto = textoLegibleDeValor(valor);
  if (texto === null) return <span className="italic text-muted">sin valor</span>;
  return <span className={nuevo ? "font-medium" : "text-muted line-through decoration-muted/60"}>{texto}</span>;
}

// Solo texto plano: los valores (incluido el texto de comentarios editados) se pintan como texto de React.
// soloVisibleSolicitante: vista del solicitante. No se mezcla el historialEstatus previo, que no distingue quien lo hizo.
export function HistorialPanel({ ticket, soloVisibleSolicitante = false }: { ticket: Ticket; soloVisibleSolicitante?: boolean }) {
  const { entradas, loading, error } = useHistorial(ticket.id, soloVisibleSolicitante);
  const items = lineaDeTiempo(entradas, soloVisibleSolicitante ? [] : ticket.historialEstatus ?? []);
  const rolesPresentes = Array.from(new Set(entradas.map((e) => e.actorRol)));

  return (
    <section className="section-card p-6 space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:space-y-0 lg:gap-4">
      <div className="shrink-0 space-y-2">
        <h2 className="eyebrow">Historial de cambios</h2>
        {soloVisibleSolicitante && (
          <p className="text-xs text-muted">Aquí ves los cambios de etapa, responsable y cierre, y lo que hicieron el solicitante y el abogado asignado.</p>
        )}
        {rolesPresentes.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Colores por rol">
            {rolesPresentes.map((rol) => <EtiquetaRol key={rol} rol={rol} />)}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">No se pudo cargar el historial.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Sin cambios registrados.</p>
      ) : (
        <ol className="lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          {items.map((item) =>
            item.origen === "historial" ? (
              <li key={item.entrada.id} style={estiloRol(item.entrada.actorRol)} className="relative pb-6 pl-6 last:pb-1">
                <span aria-hidden className="absolute left-[5px] top-4 bottom-0 w-px bg-border" />
                <span aria-hidden className="absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-2 border-[hsl(var(--c))] bg-card" />

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <EtiquetaRol rol={item.entrada.actorRol} />
                  <span className="text-sm font-medium">{item.entrada.actorNombre || "Sin nombre"}</span>
                </div>
                <p className="mt-0.5 text-xs tabular-nums text-muted">{formatFechaHora(item.fecha)}</p>

                <div className="mt-2 rounded-md border border-border border-l-[3px] border-l-[hsl(var(--c))] bg-surface/40 px-3 py-2.5">
                  <p className="text-sm font-semibold">{ETIQUETA_TIPO_HISTORIAL[item.entrada.tipo] ?? item.entrada.tipo}</p>
                  <ul className="mt-1.5 space-y-2">
                    {item.entrada.cambios.map((c) => (
                      <li key={c.campo} className="text-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{c.etiqueta}</p>
                        <p className="flex flex-wrap items-baseline gap-x-1.5 whitespace-pre-wrap break-words">
                          <Valor valor={c.antes} />
                          <ArrowRight aria-label="cambió a" className="h-3 w-3 shrink-0 self-center text-muted" />
                          <Valor valor={c.despues} nuevo />
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ) : (
              <li key={`estatus-${item.fecha}-${item.estatus}`} style={estiloRol("otro")} className="relative pb-6 pl-6 last:pb-1">
                <span aria-hidden className="absolute left-[5px] top-4 bottom-0 w-px bg-border" />
                <span aria-hidden className="absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-2 border-[hsl(var(--c))] bg-card" />
                <p className="text-xs tabular-nums text-muted">{formatFechaHora(item.fecha)}</p>
                <p className="mt-1 text-sm font-semibold">Cambio de estatus</p>
                <p className="text-sm">
                  Pasó a <span className="font-medium">{item.estatus}</span>
                </p>
                <p className="text-xs text-muted">No se registró quién lo hizo (cambio anterior al historial detallado).</p>
              </li>
            )
          )}
        </ol>
      )}
    </section>
  );
}
