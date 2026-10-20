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
  return mensaje ? <p className="text-xs text-danger mt-1">{mensaje}</p> : null;
}

export function DatosContratoFields({ contrato, errors, onChange }: Props) {
  const titulo = (key: "domicilio" | "altaArrendador" | "solicitante") => () => onChange(key, toTitleCase(contrato[key]));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div className="sm:col-span-2 xl:col-span-3">
        <label className="field-label">Domicilio <span className="text-danger">*</span></label>
        <textarea
          value={contrato.domicilio}
          onChange={(e) => onChange("domicilio", e.target.value)}
          onBlur={titulo("domicilio")}
          rows={2}
          className="field w-full resize-y"
        />
        <Error mensaje={errors.domicilio} />
      </div>

      <div className="xl:col-span-2">
        <label className="field-label">Alta de Arrendador <span className="text-danger">*</span></label>
        <input
          type="text"
          value={contrato.altaArrendador}
          onChange={(e) => onChange("altaArrendador", e.target.value)}
          onBlur={titulo("altaArrendador")}
          className="w-full field"
        />
        <Error mensaje={errors.altaArrendador} />
      </div>

      <div>
        <label className="field-label">Solicitante <span className="text-danger">*</span></label>
        <input
          type="text"
          value={contrato.solicitante}
          onChange={(e) => onChange("solicitante", e.target.value)}
          onBlur={titulo("solicitante")}
          className="w-full field"
        />
        <Error mensaje={errors.solicitante} />
      </div>

      <div className="sm:col-span-2 xl:col-span-3">
        <label className="field-label">Periodo de arrendamiento <span className="text-danger">*</span></label>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={contrato.periodoInicio} onChange={(e) => onChange("periodoInicio", e.target.value)} className="field" />
          <span className="text-sm text-muted">a</span>
          <input type="date" value={contrato.periodoFin} onChange={(e) => onChange("periodoFin", e.target.value)} className="field" />
        </div>
        <Error mensaje={errors.periodoInicio || errors.periodoFin} />
      </div>

      <div>
        <label className="field-label">Condiciones para pago <span className="text-danger">*</span></label>
        <div className="flex gap-2">
          <select value={contrato.condicionesCodigo} onChange={(e) => onChange("condicionesCodigo", e.target.value)} className="w-24 field">
            <option value="">Código...</option>
            {CONDICIONES_PAGO_CODIGOS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={contrato.condicionesTipo} onChange={(e) => onChange("condicionesTipo", e.target.value)} className="flex-1 field">
            <option value="">Selecciona...</option>
            {CONDICIONES_PAGO_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Error mensaje={errors.condicionesPago} />
      </div>

      <div>
        <label className="field-label">Monto de pago (MXN) <span className="text-danger">*</span></label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={contrato.montoPago}
            onChange={(e) => onChange("montoPago", formatMontoInput(e.target.value))}
            className="field w-full pl-7 pr-14"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">MXN</span>
        </div>
        <Error mensaje={errors.montoPago} />
      </div>

      <div>
        <label className="field-label">Motivo <span className="text-danger">*</span></label>
        <select value={contrato.motivo} onChange={(e) => onChange("motivo", e.target.value)} className="w-full field">
          <option value="">Selecciona...</option>
          {MOTIVO_CONTRATO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Error mensaje={errors.motivo} />
      </div>
    </div>
  );
}
