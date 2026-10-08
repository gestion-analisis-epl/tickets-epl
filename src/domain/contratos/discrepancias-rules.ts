import type { Ticket } from "@/types/ticket";
import type { Discrepancia, ExtraccionContrato } from "@/types/resumen-contrato";

const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "los", "las", "y", "e", "en", "sa", "cv", "s", "a", "c", "v", "sapi", "rl"]);
const UMBRAL = 0.6;

export function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const tokens = (s: string) => new Set(normalizarTexto(s).split(" ").filter((t) => t && !PALABRAS_VACIAS.has(t)));
const numeros = (t: Set<string>) => new Set(Array.from(t).filter((x) => /^\d+$/.test(x)));
const mismoConjunto = (a: Set<string>, b: Set<string>) => a.size === b.size && Array.from(a).every((x) => b.has(x));

export function textosEquivalentes(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return true; // nada comparable
  const na = numeros(ta);
  const nb = numeros(tb);
  if (na.size > 0 && nb.size > 0 && !mismoConjunto(na, nb)) return false;
  const comunes = Array.from(ta).filter((t) => tb.has(t)).length;
  return comunes / Math.min(ta.size, tb.size) >= UMBRAL;
}

export function calcularDiscrepancias(ticket: Ticket, extraccion: ExtraccionContrato): Discrepancia[] {
  const contrato = ticket.contratoArrendamiento;
  if (!contrato) return [];
  const resultado: Discrepancia[] = [];

  if (extraccion.domicilio && contrato.domicilio && !textosEquivalentes(contrato.domicilio, extraccion.domicilio)) {
    resultado.push({ campo: "domicilio", valorTicket: contrato.domicilio, valorContrato: extraccion.domicilio });
  }

  if (extraccion.altaArrendador && contrato.altaArrendador && !textosEquivalentes(contrato.altaArrendador, extraccion.altaArrendador)) {
    resultado.push({ campo: "arrendador", valorTicket: contrato.altaArrendador, valorContrato: extraccion.altaArrendador });
  }

  const cambia = (t: string | undefined, c: string | null) => !!t && !!c && t !== c;
  if (cambia(contrato.periodoInicio, extraccion.periodoInicio) || cambia(contrato.periodoFin, extraccion.periodoFin)) {
    resultado.push({
      campo: "periodo",
      valorTicket: `${contrato.periodoInicio} a ${contrato.periodoFin}`,
      valorContrato: `${extraccion.periodoInicio ?? contrato.periodoInicio} a ${extraccion.periodoFin ?? contrato.periodoFin}`,
    });
  }

  return resultado;
}
