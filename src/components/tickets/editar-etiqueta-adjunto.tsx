"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { guardarEtiquetaManual } from "@/lib/documentos-etiquetas";
import { ETIQUETA_SIN_IDENTIFICAR, MAX_CARACTERES_ETIQUETA } from "@/domain/documentos/etiquetas-rules";
import { Button } from "@/components/ui/button";

interface Props {
  ticketId: string;
  url: string;
  etiquetaActual: string; // lo que se muestra hoy (nombre original, etiqueta de la IA o "Documento sin identificar")
  nombreOriginal: string;
}

// Lapiz para que Legal/admin escriban a mano que documento es. Dejarlo vacio vuelve al nombre original del archivo.
// Los datos se actualizan solos: el ticket y el resumen se escuchan en vivo.
export function EditarEtiquetaAdjunto({ ticketId, url, etiquetaActual, nombreOriginal }: Props) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setTexto(etiquetaActual === ETIQUETA_SIN_IDENTIFICAR || etiquetaActual === nombreOriginal ? "" : etiquetaActual);
    setError(null);
    setEditando(true);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await guardarEtiquetaManual(ticketId, url, texto);
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el nombre.");
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="text-muted hover:text-foreground"
        aria-label={`Cambiar el nombre de ${etiquetaActual}`}
        title="Cambiar el nombre de este documento"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={MAX_CARACTERES_ETIQUETA}
        placeholder="Ej. INE del arrendador (frente)"
        disabled={guardando}
        className="field w-64 max-w-full"
        autoFocus
      />
      <Button size="sm" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Button>
      <Button size="sm" variant="outline" onClick={() => setEditando(false)} disabled={guardando}>Cancelar</Button>
      <span className="basis-full text-xs text-muted">Archivo original: {nombreOriginal}. Déjalo vacío para volver al nombre original.</span>
      {error && <span className="basis-full text-xs text-danger">{error}</span>}
    </span>
  );
}
