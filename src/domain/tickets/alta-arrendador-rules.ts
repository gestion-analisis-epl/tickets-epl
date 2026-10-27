import type { DocumentoAltaKey, DomicilioDesglosado, TipoAlta } from "@/types/ticket";

export const DOMICILIO_VACIO: DomicilioDesglosado = {
  calle: "", numero: "", interior: "", colonia: "", municipio: "", estado: "", cp: "", entreCalles: "",
};

export const DOCUMENTOS_ALTA: { key: DocumentoAltaKey; label: string; soloCambio?: boolean }[] = [
  { key: "identificaciones", label: "Identificaciones" },
  { key: "personalidadLegal", label: "Personalidad legal" },
  { key: "acreditacionPropiedad", label: "Acreditación de propiedad" },
  { key: "predial", label: "Predial" },
  { key: "comprobanteDomicilio", label: "Comprobante de domicilio" },
  { key: "contratoAnterior", label: "Contrato anterior", soloCambio: true },
];

export function documentosAltaRequeridos(tipo: TipoAlta | "") {
  return DOCUMENTOS_ALTA.filter((d) => !d.soloCambio || tipo === "cambio");
}

export const ETIQUETAS_DOMICILIO: Record<keyof DomicilioDesglosado, string> = {
  calle: "Calle", numero: "Número", interior: "Interior (si aplica)", colonia: "Colonia",
  municipio: "Municipio", estado: "Estado", cp: "Código postal", entreCalles: "Entre calles",
};

// El texto unico sigue existiendo en contratoArrendamiento.domicilio (resumenes y correos lo usan).
export function domicilioTexto(d: DomicilioDesglosado): string {
  return [
    [d.calle, d.numero].filter(Boolean).join(" "),
    d.interior && `Int. ${d.interior}`,
    d.colonia && `Col. ${d.colonia}`,
    d.municipio,
    d.estado,
    d.cp && `CP ${d.cp}`,
    d.entreCalles && `entre ${d.entreCalles}`,
  ].filter(Boolean).join(", ");
}

export interface AltaCapturada {
  tipoAlta: TipoAlta | "";
  motivoCambio: string;
  domicilio: DomicilioDesglosado;
}

export function validarAlta(a: AltaCapturada): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!a.tipoAlta) errores.tipoAlta = "Selecciona el tipo de alta.";
  if (a.tipoAlta === "cambio" && !a.motivoCambio.trim()) errores.motivoCambio = "Explica el motivo del cambio de arrendador.";
  for (const campo of Object.keys(ETIQUETAS_DOMICILIO) as (keyof DomicilioDesglosado)[]) {
    if (campo !== "interior" && !a.domicilio[campo].trim()) errores[campo] = `Captura: ${ETIQUETAS_DOMICILIO[campo].toLowerCase()}.`;
  }
  return errores;
}
