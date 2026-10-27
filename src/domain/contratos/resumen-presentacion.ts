import type { Discrepancia, DocumentoResumen, FormaPago, GrupoDocumento, ResumenContrato } from "@/types/resumen-contrato";
import type { Estatus } from "@/types/ticket";
import { ETAPAS_VISIBLES_JEFE_ZONA } from "./contrato-rules";

// El jefe de zona conserva sus tickets aunque regresen a una etapa anterior (p. ej. por "Pedir cambios").
export function enCorreccion(estatus: Estatus): boolean {
  return !ETAPAS_VISIBLES_JEFE_ZONA.includes(estatus);
}

const prioridad = (estatus: Estatus): number => (estatus === "Pre-Cierre" ? 0 : enCorreccion(estatus) ? 1 : 2);

// Primero lo pendiente de visto bueno, luego lo que esta en correccion y al final lo cerrado.
export function ordenarResumenesJefeZona(resumenes: ResumenContrato[]): ResumenContrato[] {
  return [...resumenes].sort(
    (a, b) => prioridad(a.estatus) - prioridad(b.estatus) || b.actualizadoEn.localeCompare(a.actualizadoEn)
  );
}

// Sitio y codigo del resumen: lo que consta en el contrato; si no consta, lo capturado en la ficha del ticket.
export function sitioYCodigoResumen(
  extraccion: { sitio: string | null; codigo: string | null },
  ficha: { clave: string; alias: string }
): { sitio: string | null; codigo: string | null } {
  const limpio = (v: string | null | undefined) => (v && v.trim() ? v : null);
  return {
    sitio: limpio(extraccion.sitio) ?? limpio(ficha.alias),
    codigo: limpio(extraccion.codigo) ?? limpio(ficha.clave),
  };
}

export const NO_DISPONIBLE = "No disponible";

const formatoMonto = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMonto(monto: number | null): string {
  return monto === null ? NO_DISPONIBLE : formatoMonto.format(monto);
}

export function textoODisponible(valor: string | null | undefined): string {
  return valor && valor.trim() ? valor : NO_DISPONIBLE;
}

export interface DatoResumen {
  label: string;
  valor: string;
}

// "Datos del ticket" de Pre-Cierre/Cierre: solo los campos con informacion. Uno vacio no se muestra y
// aparece solo cuando el resumen se actualiza con su dato.
export function datosDelTicket(
  r: Pick<
    ResumenContrato,
    "solicitante" | "areaEmpresa" | "motivo" | "sitioClave" | "sitioAlias" | "domicilio" | "altaArrendador"
    | "metodoPago" | "condicionesPago" | "montoPagoAnual" | "formaPago"
  >,
  extra: { servicio: string | null; fechaSolicitud: string | null; periodo: string | null }
): DatoResumen[] {
  const lleno = (v: string | null | undefined) => (v && v.trim() ? v : null);
  const sitio = r.sitioClave ? `${r.sitioClave}${r.sitioAlias ? ` — ${r.sitioAlias}` : ""}` : null;
  const candidatos: [string, string | null][] = [
    ["Solicitante", lleno(r.solicitante)],
    ["Empresa / Área", lleno(r.areaEmpresa)],
    ["Servicio", lleno(extra.servicio)],
    ["Fecha de solicitud", lleno(extra.fechaSolicitud)],
    ["Motivo", lleno(r.motivo)],
    ["Sitio", sitio],
    ["Codigo", lleno(r.sitioClave)],
    ["Domicilio", lleno(r.domicilio)],
    ["Alta de arrendador", lleno(r.altaArrendador)],
    ["Periodo", lleno(extra.periodo)],
    ["Metodo de pago", lleno(r.metodoPago)],
    ["Condiciones de pago", lleno(r.condicionesPago)],
    ["Monto anual", r.montoPagoAnual === null ? null : formatMonto(r.montoPagoAnual)],
    ["Forma de pago", r.formaPago ? formaPagoLabel(r.formaPago) : null],
  ];
  return candidatos.flatMap(([label, valor]) => (valor ? [{ label, valor }] : []));
}

const FORMA_PAGO_LABEL: Record<FormaPago, string> = {
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  bianual: "Bianual",
  otra: "Otra",
};

export function formaPagoLabel(forma: FormaPago | null): string {
  return forma ? FORMA_PAGO_LABEL[forma] : NO_DISPONIBLE;
}

const TITULO_GRUPO: Record<GrupoDocumento, string> = {
  formato: "Formato de solicitud de arrendamiento",
  arrendamiento: "Documentos de arrendamiento",
  adjunto: "Documentación adjunta",
};

// Mismas secciones que la solicitud. Los resumenes previos no traen grupo: van todos juntos hasta que se actualicen.
export function agruparDocumentos(documentos: DocumentoResumen[]): { titulo: string; documentos: DocumentoResumen[] }[] {
  if (documentos.length > 0 && documentos.every((d) => !d.grupo)) {
    return [{ titulo: "Documentos del ticket", documentos }];
  }
  return (["formato", "arrendamiento", "adjunto"] as const)
    .map((g) => ({ titulo: TITULO_GRUPO[g], documentos: documentos.filter((d) => (d.grupo ?? "adjunto") === g) }))
    .filter((g) => g.documentos.length > 0);
}

const CAMPO_LABEL:Record<Discrepancia["campo"], string> = {
  domicilio: "Domicilio",
  periodo: "Periodo",
  arrendador: "Arrendador",
};

export function textoDiscrepancia(d: Discrepancia): string {
  return `${CAMPO_LABEL[d.campo]}: el contrato dice ${d.valorContrato}, el ticket dice ${d.valorTicket}`;
}
