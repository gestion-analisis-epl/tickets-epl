"use client";

import { CONDICIONES_PAGO_CODIGOS, CONDICIONES_PAGO_TIPOS, MOTIVO_CONTRATO_OPTIONS } from "@/lib/data/arrendamientos-temporal";
import { toTitleCase, formatMontoInput } from "@/lib/text-format";
import type { ContratoCapturado } from "@/domain/tickets/nuevo-ticket-validacion";

interface Props {
  contrato: ContratoCapturado;
  errors: Record<string, string>;
  onChange: <K extends keyof ContratoCapturado>(key: K, value: ContratoCapturado[K]) => void;
}

function Error({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p className="text-sm text-danger mt-1.5">{mensaje}</p> : null;
}

function Ayuda({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted mt-1.5">{children}</p>;
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <label className="field-label">{children} <span className="text-danger" aria-label="obligatorio">*</span></label>;
}

// Una sola columna en pantallas chicas y dos en las demas: cada dato con su propia etiqueta y todo el ancho
// de su columna, para que ningun texto (p. ej. "Transferencia") quede cortado.
export function DatosContratoFields({ contrato, errors, onChange }: Props) {
  const titulo = (key: "domicilio" | "altaArrendador" | "solicitante") => () => onChange(key, toTitleCase(contrato[key]));

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
      <div className="min-w-0 sm:col-span-2">
        <Etiqueta>Domicilio del inmueble</Etiqueta>
        <textarea
          value={contrato.domicilio}
          onChange={(e) => onChange("domicilio", e.target.value)}
          onBlur={titulo("domicilio")}
          rows={2}
          className="field w-full resize-y"
        />
        <Ayuda>Calle, número, colonia, ciudad y código postal.</Ayuda>
        <Error mensaje={errors.domicilio} />
      </div>

      <div className="min-w-0">
        <Etiqueta>Arrendador dado de alta</Etiqueta>
        <input
          type="text"
          value={contrato.altaArrendador}
          onChange={(e) => onChange("altaArrendador", e.target.value)}
          onBlur={titulo("altaArrendador")}
          className="w-full field"
        />
        <Ayuda>Nombre de la persona o empresa dueña del inmueble.</Ayuda>
        <Error mensaje={errors.altaArrendador} />
      </div>

      <div className="min-w-0">
        <Etiqueta>Solicitante</Etiqueta>
        <input
          type="text"
          value={contrato.solicitante}
          onChange={(e) => onChange("solicitante", e.target.value)}
          onBlur={titulo("solicitante")}
          className="w-full field"
        />
        <Ayuda>Quién pide este trámite.</Ayuda>
        <Error mensaje={errors.solicitante} />
      </div>

      <div className="min-w-0">
        <Etiqueta>Fecha de inicio del arrendamiento</Etiqueta>
        <input type="date" value={contrato.periodoInicio} onChange={(e) => onChange("periodoInicio", e.target.value)} className="field w-full" />
        <Error mensaje={errors.periodoInicio} />
      </div>

      <div className="min-w-0">
        <Etiqueta>Fecha de fin del arrendamiento</Etiqueta>
        <input type="date" value={contrato.periodoFin} onChange={(e) => onChange("periodoFin", e.target.value)} className="field w-full" />
        <Error mensaje={errors.periodoFin} />
      </div>

      <div className="min-w-0">
        <Etiqueta>Código de las condiciones de pago</Etiqueta>
        <select value={contrato.condicionesCodigo} onChange={(e) => onChange("condicionesCodigo", e.target.value)} className="w-full field">
          <option value="">Selecciona una opción</option>
          {CONDICIONES_PAGO_CODIGOS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Error mensaje={!contrato.condicionesCodigo ? errors.condicionesPago : undefined} />
      </div>

      <div className="min-w-0">
        <Etiqueta>Forma de pago</Etiqueta>
        <select value={contrato.condicionesTipo} onChange={(e) => onChange("condicionesTipo", e.target.value)} className="w-full field">
          <option value="">Selecciona una opción</option>
          {CONDICIONES_PAGO_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Error mensaje={contrato.condicionesCodigo && !contrato.condicionesTipo ? errors.condicionesPago : undefined} />
      </div>

      <div className="min-w-0">
        <Etiqueta>Monto de pago</Etiqueta>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={contrato.montoPago}
            onChange={(e) => onChange("montoPago", formatMontoInput(e.target.value))}
            className="field w-full pl-7 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">pesos</span>
        </div>
        <Ayuda>Solo números, por ejemplo 12,500.00.</Ayuda>
        <Error mensaje={errors.montoPago} />
      </div>

      <div className="min-w-0">
        <Etiqueta>Motivo del trámite</Etiqueta>
        <select value={contrato.motivo} onChange={(e) => onChange("motivo", e.target.value)} className="w-full field">
          <option value="">Selecciona una opción</option>
          {MOTIVO_CONTRATO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Error mensaje={errors.motivo} />
      </div>
    </div>
  );
}
