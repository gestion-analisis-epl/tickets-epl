"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useResumenes } from "@/hooks/use-resumenes-contrato";
import { Badge, EstatusBadge } from "@/components/ui/badge";

export function PreCierreLista() {
  const { resumenes, loading, error } = useResumenes();

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-card rounded-lg border border-border text-center">
        <p className="text-sm font-medium text-danger">No se pudo cargar la lista</p>
        <p className="text-xs text-muted mt-1">Si el problema continua, avisa a Mesa de Control.</p>
      </div>
    );
  }

  if (resumenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-card rounded-lg border border-border text-center">
        <p className="text-sm font-medium text-muted">Sin tickets en Pre-Cierre</p>
        <p className="text-xs text-muted mt-1">Aqui apareceran los contratos pendientes de visto bueno</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border border-t-2 border-t-accent overflow-hidden bg-card">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b-2 border-foreground/15">
              {["Folio", "Sitio", "Solicitante", "Etapa", "Visto bueno"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumenes.map((r) => (
              <tr key={r.ticketId} className="border-b border-border last:border-0 hover:bg-surface transition-colors">
                <td className="px-4 py-3 font-medium tabular-nums">
                  <Link href={`/pre-cierre/${r.ticketId}`} className="hover:underline">{r.folio}</Link>
                </td>
                <td className="px-4 py-3">
                  {r.sitioClave ? `${r.sitioClave}${r.sitioAlias ? ` — ${r.sitioAlias}` : ""}` : <span className="text-muted">No disponible</span>}
                </td>
                <td className="px-4 py-3">{r.solicitante}</td>
                <td className="px-4 py-3"><EstatusBadge estatus={r.estatus} /></td>
                <td className="px-4 py-3">
                  {r.vistoBueno ? <Badge tone="green">Dado por {r.vistoBueno.nombre}</Badge> : <Badge tone="gray">Pendiente</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
