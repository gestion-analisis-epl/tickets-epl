import type { Discrepancia, FormaPago, ResumenContrato } from "@/types/resumen-contrato";
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

export const NO_DISPONIBLE = "No disponible";

const formatoMonto = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMonto(monto: number | null): string {
  return monto === null ? NO_DISPONIBLE : formatoMonto.format(monto);
}

export function textoODisponible(valor: string | null | undefined): string {
  return valor && valor.trim() ? valor : NO_DISPONIBLE;
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

const CAMPO_LABEL: Record<Discrepancia["campo"], string> = {
  domicilio: "Domicilio",
  periodo: "Periodo",
  arrendador: "Arrendador",
};

export function textoDiscrepancia(d: Discrepancia): string {
  return `${CAMPO_LABEL[d.campo]}: el contrato dice ${d.valorContrato}, el ticket dice ${d.valorTicket}`;
}
