"use client";

import { useState } from "react";
import { solicitarResumenContrato } from "@/lib/contratos";
import { construirResumenContrato } from "@/domain/contratos/contrato-rules";
import { archivoPorDefecto, archivosContratoDeDocumentacion } from "@/domain/contratos/backfill-rules";
import { nombreDeUrl } from "@/domain/contratos/contrato-rules";
import { formaPagoLabel, formatMonto, sitioYCodigoResumen, textoDiscrepancia, textoODisponible } from "@/domain/contratos/resumen-presentacion";
import { partesSitio } from "@/lib/ticket-derived";
import { formatFecha, formatFechaSolo } from "@/lib/format-fecha";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateTicketResumenManual } from "@/lib/tickets";
import type { EstadoResumen, ExtraccionContrato, FormaPago } from "@/types/resumen-contrato";
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

const FORMAS_PAGO: FormaPago[] = ["mensual", "bimestral", "trimestral", "semestral", "anual", "bianual", "otra"];

const EXTRACCION_VACIA: ExtraccionContrato = {
  sitio: null, codigo: null, domicilio: null, altaArrendador: null, solicitante: null,
  periodoInicio: null, periodoFin: null, condicionesPago: null, montoPagoAnual: null, formaPago: null,
};

const vacio = (valor: string): boolean => valor === NO_CONSTA || valor === `${NO_CONSTA} — ${NO_CONSTA}`;

const limpio = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);

function fechaContrato(valor: string | null): string {
  return valor ? formatFechaSolo(valor) : NO_CONSTA;
}

// Solo para Legal/admin: el texto del contrato se muestra siempre como texto plano.
export function ResumenContratoCard({ ticket }: { ticket: Ticket }) {
  const resumen = ticket.resumenContrato;
  const archivos = archivosContratoDeDocumentacion(ticket.documentacion);
  const [elegidoManual, setElegido] = useState(() => archivoPorDefecto(ticket));
  // Si el archivo elegido ya no esta en la documentacion, se vuelve al predeterminado.
  const elegido = archivos.includes(elegidoManual) ? elegidoManual : archivoPorDefecto(ticket);
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

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [borrador, setBorrador] = useState<ExtraccionContrato>(EXTRACCION_VACIA);

  // Lo capturado en la ficha del ticket manda; lo que la IA leyo completa (misma regla que ve el jefe de zona).
  const fusionado = resumen || ticket.contratoArrendamiento ? construirResumenContrato(ticket, new Date()) : null;
  const ext: ExtraccionContrato | null = fusionado
    ? {
        sitio: resumen?.extraccion?.sitio ?? null,
        codigo: resumen?.extraccion?.codigo ?? null,
        domicilio: fusionado.domicilio,
        altaArrendador: fusionado.altaArrendador,
        solicitante: fusionado.solicitante,
        periodoInicio: fusionado.periodoInicio,
        periodoFin: fusionado.periodoFin,
        condicionesPago: fusionado.condicionesPago,
        montoPagoAnual: fusionado.montoPagoAnual,
        formaPago: fusionado.formaPago,
      }
    : null;
  const puedeEditar = !!ext && !!resumen && resumen.estado !== "pendiente";

  function empezarEdicion() {
    const base = ext ?? EXTRACCION_VACIA;
    const ficha = sitioYCodigoResumen(base, partesSitio(ticket));
    setBorrador({ ...base, sitio: ficha.sitio, codigo: ficha.codigo });
    setError(null);
    setEditando(true);
  }

  async function handleGuardar() {
    setGuardando(true);
    setError(null);
    try {
      await updateTicketResumenManual(ticket.id, {
        ...borrador,
        sitio: limpio(borrador.sitio),
        codigo: limpio(borrador.codigo),
        domicilio: limpio(borrador.domicilio),
        altaArrendador: limpio(borrador.altaArrendador),
        solicitante: limpio(borrador.solicitante),
        condicionesPago: limpio(borrador.condicionesPago),
      });
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el resumen.");
    } finally {
      setGuardando(false);
    }
  }

  const texto_ = (k: "sitio" | "codigo" | "domicilio" | "altaArrendador" | "solicitante" | "condicionesPago") => ({
    value: borrador[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setBorrador({ ...borrador, [k]: e.target.value }),
    className: "field w-full",
    disabled: guardando,
  });
  const { sitio, codigo } = ext ? sitioYCodigoResumen(ext, partesSitio(ticket)) : { sitio: null, codigo: null };
  const campos: { etiqueta: string; valor: string }[] = ext
    ? [
        { etiqueta: "Sitio", valor: texto(sitio) },
        { etiqueta: "Código", valor: texto(codigo) },
        { etiqueta: "Domicilio", valor: texto(ext.domicilio) },
        { etiqueta: "Alta de arrendador", valor: texto(ext.altaArrendador) },
        { etiqueta: "Solicitante", valor: texto(ext.solicitante) },
        { etiqueta: "Periodo", valor: `${fechaContrato(ext.periodoInicio)} — ${fechaContrato(ext.periodoFin)}` },
        { etiqueta: "Metodo de pago", valor: texto(ticket.contratoArrendamiento?.condicionesPago ?? null) },
        { etiqueta: "Condiciones de pago", valor: texto(ext.condicionesPago) },
        { etiqueta: "Monto de pago anual", valor: ext.montoPagoAnual === null ? NO_CONSTA : formatMonto(ext.montoPagoAnual) },
        { etiqueta: "Forma de pago", valor: ext.formaPago ? formaPagoLabel(ext.formaPago) : NO_CONSTA },
      ]
    : [];

  return (
    <section className="section-card p-4 space-y-3">
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
        <p className="text-sm text-muted">No se encontro un contrato (.docx o .pdf) entre la documentacion adjunta.</p>
      )}

      {editando && (
        <div className="space-y-2.5 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            <label className="block"><span className="text-muted">Sitio</span><input {...texto_("sitio")} /></label>
            <label className="block"><span className="text-muted">Código</span><input {...texto_("codigo")} /></label>
            <label className="block"><span className="text-muted">Alta de arrendador</span><input {...texto_("altaArrendador")} /></label>
            <label className="block"><span className="text-muted">Solicitante</span><input {...texto_("solicitante")} /></label>
            <label className="block"><span className="text-muted">Inicio del periodo</span>
              <input type="date" className="field w-full" disabled={guardando} value={borrador.periodoInicio ?? ""}
                onChange={(e) => setBorrador({ ...borrador, periodoInicio: e.target.value || null })} />
            </label>
            <label className="block"><span className="text-muted">Fin del periodo</span>
              <input type="date" className="field w-full" disabled={guardando} value={borrador.periodoFin ?? ""}
                onChange={(e) => setBorrador({ ...borrador, periodoFin: e.target.value || null })} />
            </label>
            <label className="block"><span className="text-muted">Monto de pago anual (MXN)</span>
              <input type="number" min={0} step="0.01" className="field w-full" disabled={guardando} value={borrador.montoPagoAnual ?? ""}
                onChange={(e) => setBorrador({ ...borrador, montoPagoAnual: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} />
            </label>
            <label className="block"><span className="text-muted">Forma de pago</span>
              <select className="field w-full" disabled={guardando} value={borrador.formaPago ?? ""}
                onChange={(e) => setBorrador({ ...borrador, formaPago: (e.target.value || null) as FormaPago | null })}>
                <option value="">Sin dato</option>
                {FORMAS_PAGO.map((f) => <option key={f} value={f}>{formaPagoLabel(f)}</option>)}
              </select>
            </label>
          </div>
          <label className="block"><span className="text-muted">Domicilio</span><input {...texto_("domicilio")} /></label>
          <label className="block"><span className="text-muted">Condiciones de pago</span><input {...texto_("condicionesPago")} /></label>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleGuardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Button>
            <Button variant="outline" size="sm" onClick={() => setEditando(false)} disabled={guardando}>Cancelar</Button>
          </div>
        </div>
      )}

      {!editando && campos.length > 0 && (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {campos.filter((c) => !vacio(c.valor)).map((c) => (
              <div key={c.etiqueta}>
                <dt className="text-muted text-xs">{c.etiqueta}</dt>
                <dd className="font-medium leading-snug">{c.valor}</dd>
              </div>
            ))}
          </dl>
          {campos.some((c) => vacio(c.valor)) && (
            <p className="text-xs text-muted">
              No constan: {campos.filter((c) => vacio(c.valor)).map((c) => c.etiqueta).join(", ")}.
            </p>
          )}
        </>
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Resumen generado automaticamente; no sustituye la revision legal.</p>
        {puedeEditar && !editando && (
          <Button variant="outline" size="sm" onClick={empezarEdicion}>Editar resumen</Button>
        )}
      </div>

      {archivos.length > 0 ? (
        <div className="space-y-1.5">
          <label className="field-label">Archivo del contrato</label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
              disabled={generando}
              className="field min-w-0 max-w-full"
            >
              {archivos.map((url) => (
                <option key={url} value={url}>{nombreDeUrl(url) || url}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={handleRegenerar} disabled={generando || !elegido}>
              {generando ? "Generando…" : "Regenerar"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">No hay archivos .docx o .pdf adjuntos para generar el resumen.</p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
