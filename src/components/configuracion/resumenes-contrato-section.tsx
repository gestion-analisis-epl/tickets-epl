"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Square, Sparkles } from "lucide-react";
import { useTickets } from "@/hooks/use-tickets";
import { solicitarResumenContrato } from "@/lib/contratos";
import { crearResumenesFaltantes, type ResumenesFaltantesResultado } from "@/lib/tickets";
import { ticketsPendientesDeResumen } from "@/domain/contratos/backfill-rules";
import { encontrarContrato } from "@/domain/contratos/contrato-rules";
import { Button } from "@/components/ui/button";

interface ResultadoBackfill {
  exitos: string[];
  fallos: { folio: string; mensaje: string }[];
  detenido: boolean;
  total: number;
}

// Genera con Gemini el resumen de los tickets que aun no lo tienen. Estrictamente en serie para no saturar la cuota.
export function ResumenesContratoSection() {
  const { tickets, loading } = useTickets({ incluirExcluidos: true });
  const pendientes = useMemo(() => ticketsPendientesDeResumen(tickets), [tickets]);
  const [confirmando, setConfirmando] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [total, setTotal] = useState(0);
  const [resultado, setResultado] = useState<ResultadoBackfill | null>(null);
  const [creando, setCreando] = useState(false);
  const [faltantes, setFaltantes] = useState<ResumenesFaltantesResultado | null>(null);
  const [errorFaltantes, setErrorFaltantes] = useState<string | null>(null);
  const detenerRef = useRef(false);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      detenerRef.current = true;
    };
  }, []);

  async function handleCorrer() {
    // Se congela la lista: la suscripcion en vivo la ira achicando mientras se procesa.
    const lista = [...pendientes];
    detenerRef.current = false;
    setCorriendo(true);
    setConfirmando(false);
    setResultado(null);
    setTotal(lista.length);
    setProgreso(0);

    const exitos: string[] = [];
    const fallos: { folio: string; mensaje: string }[] = [];
    let detenido = false;

    for (let i = 0; i < lista.length; i++) {
      if (detenerRef.current) {
        detenido = true;
        break;
      }
      const t = lista[i];
      if (montadoRef.current) setProgreso(i + 1);
      try {
        const estado = await solicitarResumenContrato(t.id, encontrarContrato(t.documentacion) ?? undefined);
        if (estado === "error") fallos.push({ folio: t.folio, mensaje: "Gemini no pudo extraer los datos." });
        else exitos.push(t.folio);
      } catch (err) {
        fallos.push({ folio: t.folio, mensaje: err instanceof Error ? err.message : "Error desconocido." });
      }
    }

    if (!montadoRef.current) return;
    setResultado({ exitos, fallos, detenido, total: lista.length });
    setCorriendo(false);
  }

  async function handleCrearFaltantes() {
    setCreando(true);
    setFaltantes(null);
    setErrorFaltantes(null);
    try {
      setFaltantes(await crearResumenesFaltantes(tickets));
    } catch (err) {
      setErrorFaltantes(err instanceof Error ? err.message : "No se pudo completar.");
    } finally {
      if (montadoRef.current) setCreando(false);
    }
  }

  return (
    <section className="section-card p-6 space-y-3 max-w-2xl">
      <h2 className="eyebrow">Resumenes de contrato pendientes</h2>

      <div className="space-y-2 border-b border-border pb-3">
        <p className="text-sm text-muted">
          Paso 1. Crea la ficha de resumen de todo ticket que esta o estuvo en Pre-Cierre o Cierre y no la tiene (y completa las que se crearon antes de que incluyeran servicio y documentos), para que el
          jefe de zona y Sitios lo vean (los que regresaron a una etapa anterior aparecen &quot;En correccion&quot;). No modifica
          el historial ni el SLA.
        </p>
        <Button variant="warning" disabled={loading || creando} onClick={handleCrearFaltantes}>
          {creando ? "Creando..." : "Crear resumenes faltantes"}
        </Button>
        {faltantes && (
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            Listo. Resumenes creados: {faltantes.creados}. Resumenes actualizados: {faltantes.actualizados}. Conversaciones habilitadas: {faltantes.conversacionesMarcadas}.
            {faltantes.errores.length > 0 && (
              <ul className="list-disc pl-5 text-danger">
                {faltantes.errores.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
        {errorFaltantes && <p className="text-sm text-danger">{errorFaltantes}</p>}
      </div>
      <p className="text-sm text-muted">Paso 2. Generar con IA los datos del contrato:</p>
      <p className="text-sm text-muted">
        Genera con IA el resumen de los tickets que tienen un contrato de arrendamiento (.docx o .pdf) adjunto y aun no tienen
        resumen, o cuyo resumen fallo o quedo atascado en pendiente. Se procesan de uno en uno.{" "}
        {!loading && <>Pendientes ahora: <span className="font-medium">{pendientes.length}</span>.</>}
      </p>

      {!corriendo && !confirmando && (
        <Button variant="warning" disabled={loading || pendientes.length === 0} onClick={() => setConfirmando(true)}>
          <Sparkles className="h-4 w-4" />
          Generar resumenes pendientes ({pendientes.length})
        </Button>
      )}

      {!corriendo && confirmando && (
        <div className="space-y-3">
          <p className="text-sm">
            Se enviaran los contratos de <span className="font-medium">{pendientes.length} ticket(s)</span> a Google
            AI Studio, uno por uno. Puedes detenerlo en cualquier momento.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="warning" onClick={handleCorrer}>Si, generar</Button>
            <Button variant="outline" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {corriendo && (
        <div className="space-y-3">
          <p className="text-sm tabular-nums">Procesando {progreso} / {total}…</p>
          <Button variant="danger" onClick={() => { detenerRef.current = true; }}>
            <Square className="h-4 w-4" />
            Detener
          </Button>
        </div>
      )}

      {resultado && (
        <div className="space-y-2 text-sm">
          <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-success">
            {resultado.detenido ? "Detenido. " : "Listo. "}
            {resultado.exitos.length} de {resultado.total} generados
            {resultado.exitos.length > 0 && <>: {resultado.exitos.join(", ")}</>}.
          </div>
          {resultado.fallos.length > 0 && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-danger">
              <p>{resultado.fallos.length} con error:</p>
              <ul className="list-disc pl-5">
                {resultado.fallos.map((f) => (
                  <li key={f.folio}>{f.folio}: {f.mensaje}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
