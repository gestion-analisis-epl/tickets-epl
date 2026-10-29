import type { AltaArrendadorInput, DocumentoAltaKey, TipoAlta, Ticket } from "@/types/ticket";
import { SERVICIO_ALTA_ARRENDADOR_ID } from "@/lib/data/arrendamientos-temporal";

export const DOCUMENTOS_ALTA: { key: DocumentoAltaKey; label: string; ayuda: string; soloCambio?: boolean }[] = [
  { key: "identificaciones", label: "Identificación", ayuda: "Identificación oficial del arrendador." },
  { key: "personalidadLegal", label: "Personalidad legal", ayuda: "Documento que muestra quién puede firmar por el arrendador.", soloCambio: true },
  { key: "acreditacionPropiedad", label: "Acreditación de propiedad", ayuda: "Escrituras u otro documento que muestre que es el dueño del inmueble." },
  { key: "predial", label: "Predial", ayuda: "Recibo del impuesto predial." },
  { key: "comprobanteDomicilio", label: "Comprobante de domicilio", ayuda: "Recibo que muestre el domicilio del arrendador." },
  { key: "contratoAnterior", label: "Contrato anterior", ayuda: "El contrato con el arrendador que se sustituye.", soloCambio: true },
];

export function documentosAltaRequeridos(tipo: TipoAlta | "") {
  return DOCUMENTOS_ALTA.filter((d) => !d.soloCambio || tipo === "cambio");
}

// El domicilio no va aqui: se captura una sola vez, en los datos del contrato (contratoArrendamiento.domicilio).
export interface AltaCapturada {
  tipoAlta: TipoAlta | "";
  motivoCambio: string;
}

export function validarAlta(a: AltaCapturada): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!a.tipoAlta) errores.tipoAlta = "Selecciona el tipo de alta.";
  if (a.tipoAlta === "cambio" && !a.motivoCambio.trim()) errores.motivoCambio = "Explica el motivo del cambio de arrendador.";
  return errores;
}

// Ticket de Alta anterior al formulario nuevo (sin datos de alta) o que el abogado ya completo
// retroactivamente: el abogado asignado lo sigue editando aunque este en Cierre.
export function esAltaRetroactiva(t: Pick<Ticket, "servicioId" | "altaArrendador">): boolean {
  return t.servicioId === SERVICIO_ALTA_ARRENDADOR_ID && (!t.altaArrendador || t.altaArrendador.retroactiva === true);
}

// En un ticket anterior solo el tipo de alta es obligatorio: los documentos se capturan si existen.
export function validarAltaRetroactiva(a: AltaCapturada): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!a.tipoAlta) errores.tipoAlta = "Selecciona el tipo de alta.";
  if (a.tipoAlta === "cambio" && !a.motivoCambio.trim()) errores.motivoCambio = "Explica el motivo del cambio de arrendador.";
  return errores;
}

// Los 4 documentos que pedia el formulario anterior pasan a su nombre nuevo para no perderlos de vista.
export function documentosAltaIniciales(
  t: Pick<Ticket, "altaArrendador" | "documentosArrendamiento">
): Partial<Record<DocumentoAltaKey, string>> {
  if (t.altaArrendador) return { ...t.altaArrendador.documentos };
  const viejos = t.documentosArrendamiento;
  const equivalencias: [keyof NonNullable<typeof viejos>, DocumentoAltaKey][] = [
    ["escrituras", "acreditacionPropiedad"],
    ["identificacionArrendador", "identificaciones"],
    ["predial", "predial"],
    ["comprobanteDomicilio", "comprobanteDomicilio"],
  ];
  return Object.fromEntries(equivalencias.flatMap(([viejo, nuevo]) => (viejos?.[viejo] ? [[nuevo, viejos[viejo]]] : [])));
}

export interface AltaRetroactivaCapturada extends AltaCapturada {
  geolocalizacion: string | null;
  documentos: Partial<Record<DocumentoAltaKey, string>>;
}

// Firestore rechaza undefined: el bloque solo lleva las llaves que tienen valor.
export function calcularPatchAltaRetroactiva(entrada: AltaRetroactivaCapturada): Partial<Ticket> {
  const tipo = entrada.tipoAlta as TipoAlta;
  const documentos = Object.fromEntries(
    DOCUMENTOS_ALTA.filter((d) => (!d.soloCambio || tipo === "cambio") && entrada.documentos[d.key])
      .map((d) => [d.key, entrada.documentos[d.key]])
  ) as AltaArrendadorInput["documentos"];

  const patch: Partial<Ticket> = {
    altaArrendador: {
      tipoAlta: tipo,
      ...(tipo === "cambio" && entrada.motivoCambio.trim() ? { motivoCambio: entrada.motivoCambio.trim() } : {}),
      ...(entrada.geolocalizacion ? { geolocalizacion: entrada.geolocalizacion } : {}),
      documentos,
      retroactiva: true,
    },
  };
  return patch;
}
