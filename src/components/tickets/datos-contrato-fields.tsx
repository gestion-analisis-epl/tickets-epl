"use client";

import { Campo } from "@/components/forms/campo";
import { CONDICIONES_PAGO_CODIGOS, CONDICIONES_PAGO_TIPOS, MOTIVO_CONTRATO_OPTIONS } from "@/lib/data/arrendamientos-temporal";
import { toTitleCase, formatMontoInput } from "@/lib/text-format";
import type { ContratoCapturado } from "@/domain/tickets/nuevo-ticket-validacion";

interface Props {
  contrato: ContratoCapturado;
  errors: Record<string, string>;
  onChange: <K extends keyof ContratoCapturado>(key: K, value: ContratoCapturado[K]) => void;
}

// Una sola columna en pantallas chicas y dos en las demas: cada dato con su propia etiqueta y todo el ancho
// de su columna, para que ningun texto (p. ej. "Transferencia") quede cortado.
export function DatosContratoFields({ contrato, errors, onChange }: Props) {
  const titulo = (key: "domicilio" | "altaArrendador" | "solicitante") => () => onChange(key, toTitleCase(contrato[key]));

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
      <Campo id="contrato-domicilio" etiqueta="Domicilio del inmueble" ayuda="Calle, número, colonia, ciudad y código postal." error={errors.domicilio} className="sm:col-span-2">
        <textarea
          id="contrato-domicilio"
          value={contrato.domicilio}
          onChange={(e) => onChange("domicilio", e.target.value)}
          onBlur={titulo("domicilio")}
          rows={2}
          aria-invalid={!!errors.domicilio}
          className="field w-full resize-y"
        />
      </Campo>

      <Campo id="contrato-arrendador" etiqueta="Arrendador dado de alta" ayuda="Nombre de la persona o empresa dueña del inmueble." error={errors.altaArrendador}>
        <input
          id="contrato-arrendador"
          type="text"
          value={contrato.altaArrendador}
          onChange={(e) => onChange("altaArrendador", e.target.value)}
          onBlur={titulo("altaArrendador")}
          aria-invalid={!!errors.altaArrendador}
          className="w-full field"
        />
      </Campo>

      <Campo id="contrato-solicitante" etiqueta="Solicitante" ayuda="Quién pide este trámite." error={errors.solicitante}>
        <input
          id="contrato-solicitante"
          type="text"
          value={contrato.solicitante}
          onChange={(e) => onChange("solicitante", e.target.value)}
          onBlur={titulo("solicitante")}
          aria-invalid={!!errors.solicitante}
          className="w-full field"
        />
      </Campo>

      <Campo id="contrato-inicio" etiqueta="Fecha de inicio del arrendamiento" error={errors.periodoInicio}>
        <input id="contrato-inicio" type="date" value={contrato.periodoInicio} onChange={(e) => onChange("periodoInicio", e.target.value)} aria-invalid={!!errors.periodoInicio} className="field w-full" />
      </Campo>

      <Campo id="contrato-fin" etiqueta="Fecha de fin del arrendamiento" error={errors.periodoFin}>
        <input id="contrato-fin" type="date" value={contrato.periodoFin} onChange={(e) => onChange("periodoFin", e.target.value)} aria-invalid={!!errors.periodoFin} className="field w-full" />
      </Campo>

      <Campo id="contrato-codigo" etiqueta="Código de las condiciones de pago" error={!contrato.condicionesCodigo ? errors.condicionesPago : undefined}>
        <select id="contrato-codigo" value={contrato.condicionesCodigo} onChange={(e) => onChange("condicionesCodigo", e.target.value)} aria-invalid={!contrato.condicionesCodigo && !!errors.condicionesPago} className="w-full field">
          <option value="">Selecciona una opción</option>
          {CONDICIONES_PAGO_CODIGOS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Campo>

      <Campo id="contrato-forma" etiqueta="Forma de pago" error={contrato.condicionesCodigo && !contrato.condicionesTipo ? errors.condicionesPago : undefined}>
        <select id="contrato-forma" value={contrato.condicionesTipo} onChange={(e) => onChange("condicionesTipo", e.target.value)} aria-invalid={!!contrato.condicionesCodigo && !contrato.condicionesTipo && !!errors.condicionesPago} className="w-full field">
          <option value="">Selecciona una opción</option>
          {CONDICIONES_PAGO_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Campo>

      <Campo id="contrato-monto" etiqueta="Monto de pago" ayuda="Solo números, por ejemplo 12,500.00." error={errors.montoPago}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
          <input
            id="contrato-monto"
            type="text"
            inputMode="decimal"
            value={contrato.montoPago}
            onChange={(e) => onChange("montoPago", formatMontoInput(e.target.value))}
            aria-invalid={!!errors.montoPago}
            className="field w-full pl-7 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">pesos</span>
        </div>
      </Campo>

      <Campo id="contrato-motivo" etiqueta="Motivo del trámite" error={errors.motivo}>
        <select id="contrato-motivo" value={contrato.motivo} onChange={(e) => onChange("motivo", e.target.value)} aria-invalid={!!errors.motivo} className="w-full field">
          <option value="">Selecciona una opción</option>
          {MOTIVO_CONTRATO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Campo>
    </div>
  );
}
