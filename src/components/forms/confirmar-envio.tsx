"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmarEnvioProps {
  abierto: boolean;
  enviando: boolean;
  error: string | null;
  resumen: [etiqueta: string, valor: string][];
  onVolver: () => void;
  onConfirmar: () => void;
}

// Ultima revision antes de enviar. Usa el <dialog> del navegador: bloquea el fondo y Escape lo cierra.
export function ConfirmarEnvio({ abierto, enviando, error, resumen, onVolver, onConfirmar }: ConfirmarEnvioProps) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => { e.preventDefault(); if (!enviando) onVolver(); }}
      className="w-[calc(100%-2rem)] max-w-lg rounded-md border border-border border-t-[3px] border-t-accent bg-card p-0 text-foreground backdrop:bg-black/55"
    >
      <div className="p-5 sm:p-6">
        <h2 className="section-title text-xl">Revisa antes de enviar</h2>
        <p className="text-sm text-muted mt-1">Mesa de Control recibirá esta solicitud. Podrás seguirla desde &quot;Tickets&quot;.</p>

        <dl className="my-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
          {resumen.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="contents">
              <dt className="text-muted">{etiqueta}</dt>
              <dd className="font-semibold break-words">{valor}</dd>
            </div>
          ))}
        </dl>

        {error && <p role="alert" className="mb-4 text-sm font-semibold text-danger">{error}</p>}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onVolver} disabled={enviando}>Volver y corregir</Button>
          <Button type="button" variant="success" onClick={onConfirmar} disabled={enviando}>
            {enviando ? "Enviando..." : "Sí, enviar solicitud"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
