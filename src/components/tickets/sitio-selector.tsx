"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { useSitios } from "@/hooks/use-sitios";
import {
  aplicarSeleccion, campoBloqueado, opcionesCampo, SELECCION_VACIA, siguienteAncla,
  type AnclaSitio, type CampoSitio, type SeleccionSitio,
} from "@/domain/sitios/sitios-rules";
import type { SitioArrendamiento } from "@/types/ticket";

export function seleccionDeSitio(sitio: SitioArrendamiento | undefined): SeleccionSitio {
  return sitio ? { ...sitio } : SELECCION_VACIA;
}

interface SitioSelectorProps {
  value: SeleccionSitio;
  onChange: (seleccion: SeleccionSitio) => void;
  error?: string;
}

const CAMPOS: { campo: CampoSitio; etiqueta: string; placeholder: string }[] = [
  { campo: "clave", etiqueta: "Clave", placeholder: "Busca una clave..." },
  { campo: "alias", etiqueta: "Alias", placeholder: "Busca un alias..." },
];

export function SitioSelector({ value, onChange, error }: SitioSelectorProps) {
  const { sitios, loading, error: errorCarga, desactualizado, reintentar } = useSitios();
  // Sin ancla (p. ej. ticket que ya traia sitio) Clave y Alias quedan bloqueados hasta limpiar.
  const [ancla, setAncla] = useState<AnclaSitio>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-70">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando catalogo de sitios...
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm">
        <p className="text-danger">{errorCarga}</p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={reintentar}>
          Reintentar
        </Button>
      </div>
    );
  }

  function limpiar() {
    setAncla(null);
    onChange(SELECCION_VACIA);
  }

  function handleCambio(campo: CampoSitio, valor: string) {
    // Vaciar el ancla reinicia el sitio: el otro campo era solo su derivado.
    if (!valor && campo === ancla) return limpiar();
    setAncla(siguienteAncla(ancla, campo, valor));
    onChange(aplicarSeleccion(sitios, value, campo, valor));
  }

  const hayAlgo = !!(value.clave || value.alias);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CAMPOS.map(({ campo, etiqueta, placeholder }) => {
          const bloqueado = campoBloqueado(value, ancla, campo);
          return (
            <div key={campo}>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
                {etiqueta} <span className="text-danger">*</span>
                {bloqueado && <Lock className="h-3 w-3 opacity-50" aria-label="Bloqueado" />}
              </label>
              <Combobox
                value={value[campo]}
                options={opcionesCampo(sitios, value, campo)}
                onChange={(v) => handleCambio(campo, v)}
                placeholder={placeholder}
                disabled={bloqueado}
                invalid={!!error}
              />
            </div>
          );
        })}
      </div>
      {hayAlgo && (
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={limpiar}>
          Limpiar sitio
        </Button>
      )}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      {desactualizado && (
        <p className="text-xs opacity-60 mt-1">
          No se pudo actualizar el catalogo desde Sheets; se muestra la ultima version cargada.
        </p>
      )}
    </div>
  );
}
