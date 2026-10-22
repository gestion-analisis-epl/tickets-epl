"use client";

import { useState } from "react";
import { actualizarVisibilidadHistorial, type ResultadoVisibilidadHistorial } from "@/lib/historial-visibilidad";
import { Button } from "@/components/ui/button";

export function HistorialVisibilidadSection() {
  const [corriendo, setCorriendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoVisibilidadHistorial | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function aplicar() {
    setCorriendo(true);
    setResultado(null);
    setError(null);
    try {
      setResultado(await actualizarVisibilidadHistorial());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar.");
    } finally {
      setCorriendo(false);
    }
  }

  return (
    <section className="section-card p-6 space-y-3 max-w-2xl">
      <h2 className="eyebrow">Visibilidad del historial</h2>
      <p className="text-sm text-muted">
        El solicitante y los abogados ven los cambios de etapa, responsable, cierre y visto bueno, sin importar quien los haga.
        Esto marca como visibles las entradas anteriores de ese tipo. No modifica nada mas del historial.
      </p>
      <Button variant="warning" disabled={corriendo} onClick={aplicar}>
        {corriendo ? "Actualizando..." : "Actualizar historial anterior"}
      </Button>
      {resultado && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Listo. Entradas revisadas: {resultado.revisadas}. Actualizadas: {resultado.actualizadas}.
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
