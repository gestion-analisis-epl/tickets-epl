"use client";

import { useMemo, useRef, useState } from "react";
import { Square, Sparkles } from "lucide-react";
import { useTickets } from "@/hooks/use-tickets";
import { solicitarResumenContrato } from "@/lib/contratos";
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
  const detenerRef = useRef(false);

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
      setProgreso(i + 1);
      try {
        const estado = await solicitarResumenContrato(t.id, encontrarContrato(t.documentacion) ?? undefined);
        if (estado === "error") fallos.push({ folio: t.folio, mensaje: "Gemini no pudo extraer los datos." });
        else exitos.push(t.folio);
      } catch (err) {
        fallos.push({ folio: t.folio, mensaje: err instanceof Error ? err.message : "Error desconocido." });
      }
    }

    setResultado({ exitos, fallos, detenido, total: lista.length });
    setCorriendo(false);
  }

  return (
    <section className="section-card p-6 space-y-3 max-w-2xl">
      <h2 className="eyebrow">Resumenes de contrato pendientes</h2>
      <p className="text-sm text-muted">
        Genera con IA el resumen de los tickets que tienen un contrato de arrendamiento adjunto pero aun no tienen
        resumen. Se procesan de uno en uno.{" "}
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
