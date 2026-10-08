"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldAlert, Download, ArrowLeft, AlertTriangle } from "lucide-react";
import { useResumen } from "@/hooks/use-resumenes-contrato";
import { registrarVistoBueno } from "@/lib/resumenes-contrato";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { EstatusBadge } from "@/components/ui/badge";
import { formatFecha, formatFechaSolo } from "@/lib/format-fecha";
import { formaPagoLabel, formatMonto, textoDiscrepancia, textoODisponible } from "@/domain/contratos/resumen-presentacion";
import type { EstadoResumen } from "@/types/resumen-contrato";

const AVISO_ESTADO: Partial<Record<EstadoResumen, string>> = {
  pendiente: "El resumen del contrato aún no se genera.",
  error: "No se pudo generar el resumen.",
  sin_contrato: "El ticket no tiene el contrato de arrendamiento adjunto.",
};

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

export function PreCierreDetalle({ id }: { id: string }) {
  const { resumen, loading, forbidden } = useResumen(id);
  const uid = useAuthStore((s) => s.uid);
  const nombre = useAuthStore((s) => s.nombre);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  if (forbidden || !resumen) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
        <ShieldAlert className="h-6 w-6 text-muted" />
        <p className="text-sm font-medium text-muted">{forbidden ? "No tienes acceso a este resumen" : "Resumen no encontrado"}</p>
        <Link href="/pre-cierre" className="text-sm underline">Volver a Pre-Cierre</Link>
      </div>
    );
  }

  const aviso = AVISO_ESTADO[resumen.estadoResumen];
  const puedeDarVistoBueno = resumen.estatus === "Pre-Cierre" && !resumen.vistoBueno;

  async function darVistoBueno() {
    if (!uid) return;
    setGuardando(true);
    setError(null);
    try {
      await registrarVistoBueno(id, { uid, nombre: nombre ?? "" });
    } catch {
      setError("No se pudo registrar el visto bueno. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const periodo =
    resumen.periodoInicio || resumen.periodoFin
      ? `${formatFechaSolo(resumen.periodoInicio)} — ${formatFechaSolo(resumen.periodoFin)}`
      : null;

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/pre-cierre" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pre-Cierre
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-rule text-3xl font-semibold tabular-nums">{resumen.folio}</h1>
        <EstatusBadge estatus={resumen.estatus} />
      </div>

      {aviso && (
        <div role="status" className="flex items-start gap-2 rounded-md border border-border bg-surface p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{aviso}</p>
        </div>
      )}

      {resumen.discrepancias.length > 0 && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold mb-1">Discrepancias entre el contrato y el ticket</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {resumen.discrepancias.map((d) => (
              <li key={d.campo}>{textoDiscrepancia(d)}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="section-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Contrato</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Campo label="Sitio">
            {resumen.sitioClave ? `${resumen.sitioClave}${resumen.sitioAlias ? ` — ${resumen.sitioAlias}` : ""}` : textoODisponible(null)}
          </Campo>
          <Campo label="Codigo">{textoODisponible(resumen.sitioClave)}</Campo>
          <Campo label="Domicilio">{textoODisponible(resumen.domicilio)}</Campo>
          <Campo label="Alta de arrendador">{textoODisponible(resumen.altaArrendador)}</Campo>
          <Campo label="Solicitante">{textoODisponible(resumen.solicitante)}</Campo>
          <Campo label="Periodo">{textoODisponible(periodo)}</Campo>
          <Campo label="Condiciones de pago">{textoODisponible(resumen.condicionesPago)}</Campo>
          <Campo label="Monto anual">{formatMonto(resumen.montoPagoAnual)}</Campo>
          <Campo label="Forma de pago">{formaPagoLabel(resumen.formaPago)}</Campo>
        </dl>

        {resumen.contratoUrl && (
          <a
            href={resumen.contratoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium underline"
          >
            <Download className="h-4 w-4" />
            Descargar contrato original{resumen.contratoNombre ? ` (${resumen.contratoNombre})` : ""}
          </a>
        )}

        <p className="text-xs text-muted">Resumen generado automáticamente; no sustituye la revisión legal del contrato.</p>
      </section>

      <section className="section-card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Visto bueno</h2>
        {resumen.vistoBueno ? (
          <p className="text-sm font-medium">
            Visto bueno dado por {resumen.vistoBueno.nombre} el {formatFecha(resumen.vistoBueno.fecha, { conHora: true })}
          </p>
        ) : puedeDarVistoBueno ? (
          <>
            <Button variant="success" onClick={darVistoBueno} disabled={guardando}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Dar visto bueno
            </Button>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </>
        ) : (
          <p className="text-sm text-muted">Sin visto bueno registrado.</p>
        )}
      </section>
    </div>
  );
}
