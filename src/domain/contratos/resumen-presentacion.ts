import type { Discrepancia, FormaPago } from "@/types/resumen-contrato";

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
