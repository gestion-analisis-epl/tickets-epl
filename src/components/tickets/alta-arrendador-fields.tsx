"use client";

import { Campo } from "@/components/forms/campo";
import { cn } from "@/lib/utils";
import type { AltaCapturada } from "@/domain/tickets/alta-arrendador-rules";
import type { TipoAlta } from "@/types/ticket";
import { MapaSitio } from "./mapa-sitio";

interface Props {
  alta: AltaCapturada;
  errors: Record<string, string>;
  geolocalizacion: string | null; // null = el sitio no trae geolocalizacion
  onChange: (alta: AltaCapturada) => void;
}

const TIPOS: { valor: TipoAlta; titulo: string; ayuda: string }[] = [
  { valor: "nuevo", titulo: "Nuevo arrendador", ayuda: "El sitio no tenía arrendador registrado." },
  { valor: "cambio", titulo: "Cambio de arrendador", ayuda: "Otra persona o empresa sustituye a la anterior." },
];

export function AltaArrendadorFields({ alta, errors, geolocalizacion, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <fieldset className="min-w-0">
        <legend className="field-label">
          ¿Qué tipo de alta es? <span className="text-danger" aria-hidden="true">*</span>
          <span className="sr-only"> (obligatorio)</span>
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TIPOS.map((t) => (
            <label
              key={t.valor}
              className={cn(
                "relative cursor-pointer rounded-md border-[1.5px] bg-card py-3.5 pl-11 pr-4",
                alta.tipoAlta === t.valor ? "border-primary bg-primary/5 ring-1 ring-primary" : errors.tipoAlta ? "border-danger" : "border-input",
                "focus-within:ring-2 focus-within:ring-ring/40"
              )}
            >
              <input
                type="radio"
                name="tipoAlta"
                value={t.valor}
                checked={alta.tipoAlta === t.valor}
                onChange={() => onChange({ ...alta, tipoAlta: t.valor, motivoCambio: t.valor === "cambio" ? alta.motivoCambio : "" })}
                className="absolute left-4 top-4 h-[18px] w-[18px] accent-[hsl(var(--primary))]"
              />
              <span className="block text-[15px] font-semibold">{t.titulo}</span>
              <span className="block text-sm text-muted">{t.ayuda}</span>
            </label>
          ))}
        </div>
        {errors.tipoAlta && <p role="alert" className="mt-1.5 text-sm font-semibold text-danger">{errors.tipoAlta}</p>}
      </fieldset>

      {alta.tipoAlta === "cambio" && (
        <Campo id="alta-motivo" etiqueta="¿Por qué cambia el arrendador?" ayuda="Cuéntalo con tus palabras, por ejemplo: el dueño anterior vendió el terreno." error={errors.motivoCambio}>
          <textarea
            id="alta-motivo"
            value={alta.motivoCambio}
            onChange={(e) => onChange({ ...alta, motivoCambio: e.target.value })}
            rows={3}
            aria-invalid={!!errors.motivoCambio}
            className="field w-full resize-y"
          />
        </Campo>
      )}

      {geolocalizacion && (
        <div className="min-w-0">
          <p className="field-label">Ubicación del sitio</p>
          <MapaSitio geolocalizacion={geolocalizacion} />
          <p className="text-xs text-muted mt-1.5">Se toma automáticamente del sitio que elegiste.</p>
        </div>
      )}
    </div>
  );
}
