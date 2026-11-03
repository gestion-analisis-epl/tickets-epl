"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Square, Tags } from "lucide-react";
import { useTickets } from "@/hooks/use-tickets";
import { solicitarEtiquetado } from "@/lib/documentos-etiquetas";
import { adjuntosSinEtiqueta, sinIdentificarDelTicket } from "@/domain/documentos/etiquetas-rules";
import { nombreDeUrl } from "@/domain/documentos/nombre-url";
import { Button } from "@/components/ui/button";

interface Resultado {
  total: number;
  etiquetados: number;
  sinIdentificar: number;
  errores: { folio: string; mensaje: string }[];
  detenido: boolean;
}

// Pone nombre legible con IA a las fotos/escaneos que llegan como IMG_5212.jpeg. Solo admin (vive en Mantenimiento).
// Estrictamente en serie para no saturar la cuota de Gemini.
export function EtiquetasDocumentosSection() {
  const { tickets, loading } = useTickets({ incluirExcluidos: true });
  const pendientes = useMemo(() => tickets.filter((t) => adjuntosSinEtiqueta(t).length > 0), [tickets]);
  const totalDocumentos = useMemo(() => pendientes.reduce((n, t) => n + adjuntosSinEtiqueta(t).length, 0), [pendientes]);
  const conSinIdentificar = useMemo(() => tickets.filter((t) => sinIdentificarDelTicket(t).length > 0), [tickets]);

  const [confirmando, setConfirmando] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [total, setTotal] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
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

    const acumulado: Resultado = { total: lista.length, etiquetados: 0, sinIdentificar: 0, errores: [], detenido: false };
    for (let i = 0; i < lista.length; i++) {
      if (detenerRef.current) {
        acumulado.detenido = true;
        break;
      }
      const t = lista[i];
      if (montadoRef.current) setProgreso(i + 1);
      try {
        const r = await solicitarEtiquetado(t.id);
        acumulado.etiquetados += r.etiquetados;
        acumulado.sinIdentificar += r.sinIdentificar;
        if (r.errores > 0) acumulado.errores.push({ folio: t.folio, mensaje: `${r.errores} documento(s) no se pudieron leer; se reintentan en la siguiente corrida.` });
      } catch (err) {
        acumulado.errores.push({ folio: t.folio, mensaje: err instanceof Error ? err.message : "Error desconocido." });
      }
    }

    if (!montadoRef.current) return;
    setResultado(acumulado);
    setCorriendo(false);
  }

  return (
    <section className="section-card p-6 space-y-3">
      <h2 className="eyebrow">Nombres de documentos con IA</h2>
      <p className="text-sm text-muted">
        Cuando un adjunto llega con un nombre que no dice nada (IMG_5212.jpeg, PHOTO-2026-09-18…, WhatsApp Image…, scan…), la IA lo lee y le pone un nombre corto,
        por ejemplo &quot;INE del arrendador (frente)&quot; o &quot;Predial 2026&quot;. El archivo no cambia: solo cambia el nombre que se ve en el ticket, en el resumen de
        Jefe de Zona y Sitios y dentro del ZIP. Los archivos con nombre descriptivo no se tocan. Se procesan de uno en uno.{" "}
        {!loading && (
          <>
            Pendientes ahora: <span className="font-medium">{totalDocumentos}</span> documento(s) en{" "}
            <span className="font-medium">{pendientes.length}</span> ticket(s).
          </>
        )}
      </p>

      {!corriendo && !confirmando && (
        <Button variant="warning" disabled={loading || pendientes.length === 0} onClick={() => setConfirmando(true)}>
          <Tags className="h-4 w-4" />
          Poner nombre a los documentos ({totalDocumentos})
        </Button>
      )}

      {!corriendo && confirmando && (
        <div className="space-y-3">
          <p className="text-sm">
            Se enviarán <span className="font-medium">{totalDocumentos} documento(s)</span> a Google AI Studio, uno por uno. Puedes detenerlo en cualquier momento.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="warning" onClick={handleCorrer}>Sí, ponerles nombre</Button>
            <Button variant="outline" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {corriendo && (
        <div className="space-y-3">
          <p className="text-sm tabular-nums">Procesando ticket {progreso} / {total}…</p>
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
            {resultado.etiquetados} documento(s) con nombre nuevo, {resultado.sinIdentificar} sin identificar, en {resultado.total} ticket(s).
          </div>
          {resultado.errores.length > 0 && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-danger">
              <p>{resultado.errores.length} ticket(s) con problemas:</p>
              <ul className="list-disc pl-5">
                {resultado.errores.map((e) => <li key={e.folio}>{e.folio}: {e.mensaje}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {conSinIdentificar.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-medium">La IA no supo qué documento es ({conSinIdentificar.length} ticket(s))</p>
          <p className="text-xs text-muted">Abre el ticket y usa el lápiz junto al documento para escribir qué es. Cuando lo corrijas, sale de esta lista.</p>
          <ul className="space-y-1 text-sm">
            {conSinIdentificar.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-3">
                <Link href={`/tickets/${t.id}`} className="font-display font-semibold tabular-nums text-primary hover:underline underline-offset-4">
                  {t.folio}
                </Link>
                <span className="text-muted">{sinIdentificarDelTicket(t).map((e) => nombreDeUrl(e.url)).join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
