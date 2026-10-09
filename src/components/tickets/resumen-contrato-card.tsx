"use client";

import { useState } from "react";
import { solicitarResumenContrato } from "@/lib/contratos";
import { archivoPorDefecto, docxsDeDocumentacion } from "@/domain/contratos/backfill-rules";
import { nombreDeUrl } from "@/domain/contratos/contrato-rules";
import { formaPagoLabel, formatMonto, textoDiscrepancia, textoODisponible } from "@/domain/contratos/resumen-presentacion";
import { formatFecha, formatFechaSolo } from "@/lib/format-fecha";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EstadoResumen } from "@/types/resumen-contrato";
import type { Ticket } from "@/types/ticket";

const ESTADO: Record<EstadoResumen, { label: string; tone: BadgeTone }> = {
  pendiente: { label: "Pendiente", tone: "gray" },
  listo: { label: "Listo", tone: "green" },
  error: { label: "Error", tone: "red" },
  sin_contrato: { label: "Sin contrato", tone: "amber" },
};

const NO_CONSTA = "No consta";

function texto(valor: string | null): string {
  return valor && valor.trim() ? valor : NO_CONSTA;
}

function fechaContrato(valor: string | null): string {
  return valor ? formatFechaSolo(valor) : NO_CONSTA;
}

// Solo para Legal/admin: el texto del contrato se muestra siempre como texto plano.
export function ResumenContratoCard({ ticket }: { ticket: Ticket }) {
  const resumen = ticket.resumenContrato;
  const docxs = docxsDeDocumentacion(ticket.documentacion);
  const [elegidoManual, setElegido] = useState(() => archivoPorDefecto(ticket));
  // Si el archivo elegido ya no esta en la documentacion, se vuelve al predeterminado.
  const elegido = docxs.includes(elegidoManual) ? elegidoManual : archivoPorDefecto(ticket);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerar() {
    setGenerando(true);
    setError(null);
    try {
      await solicitarResumenContrato(ticket.id, elegido);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el resumen.");
    } finally {
      setGenerando(false);
    }
  }

  const ext = resumen?.extraccion ?? null;
  const campos: { etiqueta: string; valor: string }[] = ext
    ? [
        { etiqueta: "Sitio", valor: texto(ext.sitio) },
        { etiqueta: "Codigo", valor: texto(ext.codigo) },
        { etiqueta: "Domicilio", valor: texto(ext.domicilio) },
        { etiqueta: "Alta de arrendador", valor: texto(ext.altaArrendador) },
        { etiqueta: "Solicitante", valor: texto(ext.solicitante) },
        { etiqueta: "Periodo", valor: `${fechaContrato(ext.periodoInicio)} — ${fechaContrato(ext.periodoFin)}` },
        { etiqueta: "Condiciones de pago", valor: texto(ext.condicionesPago) },
        { etiqueta: "Monto de pago anual", valor: ext.montoPagoAnual === null ? NO_CONSTA : formatMonto(ext.montoPagoAnual) },
        { etiqueta: "Forma de pago", valor: ext.formaPago ? formaPagoLabel(ext.formaPago) : NO_CONSTA },
      ]
    : [];

  return (
    <section className="section-card p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="eyebrow">Resumen del contrato</h2>
        {resumen && <Badge tone={ESTADO[resumen.estado].tone}>{ESTADO[resumen.estado].label}</Badge>}
      </div>

      {!resumen && <p className="text-sm text-muted">Aun no se genera el resumen de este contrato.</p>}

      {resumen && (
        <p className="text-xs text-muted">
          Contrato: {textoODisponible(resumen.contratoNombre)}
          {resumen.generadoEn && <> · Generado el {formatFecha(resumen.generadoEn, { conHora: true })}</>}
        </p>
      )}

      {resumen?.estado === "error" && resumen.error && <p className="text-sm text-danger">{resumen.error}</p>}
      {resumen?.estado === "sin_contrato" && (
        <p className="text-sm text-muted">No se encontro un contrato .docx entre la documentacion adjunta.</p>
      )}

      {campos.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {campos.map((c) => (
            <div key={c.etiqueta}>
              <dt className="text-muted">{c.etiqueta}</dt>
              <dd className="font-medium">{c.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {resumen && resumen.discrepancias.length > 0 && (
        <div>
          <p className="text-muted text-sm mb-1.5">Discrepancias contra el ticket</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-warning">
            {resumen.discrepancias.map((d, i) => (
              <li key={i}>{textoDiscrepancia(d)}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted">Resumen generado automaticamente; no sustituye la revision legal.</p>

      {docxs.length > 0 ? (
        <div className="space-y-2">
          <label className="field-label">Archivo del contrato</label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
              disabled={generando}
              className="field min-w-0 max-w-full"
            >
              {docxs.map((url) => (
                <option key={url} value={url}>{nombreDeUrl(url) || url}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={handleRegenerar} disabled={generando || !elegido}>
              {generando ? "Generando…" : "Regenerar"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">No hay archivos .docx adjuntos para generar el resumen.</p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
