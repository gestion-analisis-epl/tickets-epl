"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useTickets } from "@/hooks/use-tickets";
import { updateTicketExclusion } from "@/lib/tickets";
import { formatFecha } from "@/lib/format-fecha";
import { normalizar } from "@/lib/busqueda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Saca (o devuelve) tickets de prueba de la tabla, el kanban y el dashboard. No borra nada.
export function ExcluirTicketsSection() {
  const { tickets, loading } = useTickets({ incluirExcluidos: true });
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const porId = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda).trim();
    const ordenados = [...tickets].sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud));
    if (!q) return ordenados;
    return ordenados.filter((t) => [t.folio, t.solicitanteNombre, t.descripcion].some((c) => normalizar(c).includes(q)));
  }, [tickets, busqueda]);

  const elegidos = Array.from(seleccion).flatMap((id) => porId.get(id) ?? []);
  const aExcluir = elegidos.filter((t) => !t.excluidoDelPipeline);
  const aDevolver = elegidos.filter((t) => t.excluidoDelPipeline);
  const totalExcluidos = tickets.filter((t) => t.excluidoDelPipeline).length;

  function alternar(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
    setConfirmando(false);
    setResultado(null);
  }

  async function aplicar(excluido: boolean) {
    const objetivo = excluido ? aExcluir : aDevolver;
    setGuardando(true);
    setError(null);
    try {
      await Promise.all(objetivo.map((t) => updateTicketExclusion(t.id, excluido)));
      const folios = objetivo.map((t) => t.folio).join(", ");
      setResultado(
        excluido
          ? `${objetivo.length} ticket(s) fuera del pipeline: ${folios}.`
          : `${objetivo.length} ticket(s) de vuelta en el pipeline: ${folios}.`
      );
      setSeleccion(new Set());
      setConfirmando(false);
    } catch {
      setError("No se pudo completar. Intenta de nuevo; los que ya se alcanzaron a guardar se ven marcados en la tabla.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="section-card p-6 space-y-3">
      <h2 className="eyebrow">Excluir tickets de prueba del pipeline</h2>
      <p className="text-sm text-muted">
        Los tickets que marques dejan de aparecer en la tabla, el kanban y el dashboard. No se borran ni se envian
        correos: puedes devolverlos al pipeline cuando quieras.
        {totalExcluidos > 0 && <> Ahora hay <span className="font-medium">{totalExcluidos}</span> excluido(s).</>}
      </p>

      <div className="relative max-w-sm w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por folio, solicitante o descripcion..."
          className="field w-full pl-9 pr-3"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : (
        <div className="max-h-96 overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              <tr className="border-b border-border">
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2">Folio</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Solicitante</th>
                <th className="px-3 py-2">Descripcion</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => alternar(t.id)}
                  className="border-b border-border/70 last:border-0 hover:bg-accent/10 cursor-pointer align-top"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={seleccion.has(t.id)}
                      onChange={() => alternar(t.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Seleccionar ${t.folio}`}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 font-display font-semibold tabular-nums whitespace-nowrap">{t.folio}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{formatFecha(t.fechaSolicitud)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{t.solicitanteNombre}</td>
                  <td className="px-3 py-2 min-w-[16rem]">
                    <span className="line-clamp-2" title={t.descripcion}>{t.descripcion}</span>
                  </td>
                  <td className="px-3 py-2">{t.excluidoDelPipeline && <Badge tone="gray">Excluido</Badge>}</td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!confirmando ? (
        <div className="flex flex-wrap gap-3">
          <Button variant="warning" disabled={aExcluir.length === 0} onClick={() => setConfirmando(true)}>
            Excluir {aExcluir.length > 0 ? `${aExcluir.length} ` : ""}del pipeline
          </Button>
          <Button variant="outline" disabled={aDevolver.length === 0 || guardando} onClick={() => aplicar(false)}>
            Devolver {aDevolver.length > 0 ? `${aDevolver.length} ` : ""}al pipeline
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            Se sacaran del pipeline: <span className="font-medium">{aExcluir.map((t) => t.folio).join(", ")}</span>.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="warning" onClick={() => aplicar(true)} disabled={guardando}>
              {guardando ? "Guardando..." : "Si, excluir"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={guardando}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {resultado && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{resultado}</div>
      )}
    </section>
  );
}
