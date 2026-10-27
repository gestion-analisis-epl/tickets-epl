"use client";

import { ETIQUETAS_DOMICILIO, type AltaCapturada } from "@/domain/tickets/alta-arrendador-rules";
import type { DomicilioDesglosado, TipoAlta } from "@/types/ticket";

interface Props {
  alta: AltaCapturada;
  errors: Record<string, string>;
  geolocalizacion: string | null; // null = el sitio no trae geolocalizacion
  onChange: (alta: AltaCapturada) => void;
}

const CAMPOS_DOMICILIO = Object.keys(ETIQUETAS_DOMICILIO) as (keyof DomicilioDesglosado)[];

function Etiqueta({ children, obligatorio = true }: { children: React.ReactNode; obligatorio?: boolean }) {
  return <label className="field-label">{children} {obligatorio && <span className="text-danger" aria-label="obligatorio">*</span>}</label>;
}

function Error({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p className="text-sm text-danger mt-1.5">{mensaje}</p> : null;
}

export function AltaArrendadorFields({ alta, errors, geolocalizacion, onChange }: Props) {
  const setDomicilio = (campo: keyof DomicilioDesglosado, valor: string) =>
    onChange({ ...alta, domicilio: { ...alta.domicilio, [campo]: valor } });

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
      <div className="min-w-0">
        <Etiqueta>Tipo de alta de arrendador</Etiqueta>
        <select
          value={alta.tipoAlta}
          onChange={(e) => onChange({ ...alta, tipoAlta: e.target.value as TipoAlta | "", motivoCambio: e.target.value === "cambio" ? alta.motivoCambio : "" })}
          className="w-full field"
        >
          <option value="">Selecciona una opción</option>
          <option value="nuevo">Nuevo arrendador</option>
          <option value="cambio">Cambio de arrendador</option>
        </select>
        <Error mensaje={errors.tipoAlta} />
      </div>

      {alta.tipoAlta === "cambio" && (
        <div className="min-w-0 sm:col-span-2">
          <Etiqueta>Motivo del cambio de arrendador</Etiqueta>
          <textarea
            value={alta.motivoCambio}
            onChange={(e) => onChange({ ...alta, motivoCambio: e.target.value })}
            rows={3}
            className="field w-full resize-y"
          />
          <p className="text-xs text-muted mt-1.5">Explica por qué cambia el arrendador.</p>
          <Error mensaje={errors.motivoCambio} />
        </div>
      )}

      {CAMPOS_DOMICILIO.map((campo) => (
        <div key={campo} className={campo === "entreCalles" ? "min-w-0 sm:col-span-2" : "min-w-0"}>
          <Etiqueta obligatorio={campo !== "interior"}>{ETIQUETAS_DOMICILIO[campo]}</Etiqueta>
          <input type="text" value={alta.domicilio[campo]} onChange={(e) => setDomicilio(campo, e.target.value)} className="w-full field" />
          <Error mensaje={errors[campo]} />
        </div>
      ))}

      <div className="min-w-0 sm:col-span-2">
        <Etiqueta obligatorio={false}>Geolocalización del sitio</Etiqueta>
        <p className="text-sm">{geolocalizacion ?? <span className="text-muted">No disponible</span>}</p>
        <p className="text-xs text-muted mt-1.5">Se toma automáticamente del sitio que elegiste.</p>
      </div>
    </div>
  );
}
