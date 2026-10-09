import type { Ticket } from "@/types/ticket";
import type { CambioCampo } from "@/types/historial";
import { nombreDeUrl } from "@/domain/contratos/contrato-rules";

export interface CampoVigilado {
  campo: keyof Ticket;
  etiqueta: string;
  // Convierte el valor guardado en texto legible. Por defecto, textoDeValor.
  formato?: (valor: unknown) => string | null;
}

function esSitio(valor: unknown): valor is { clave: string; alias: string } {
  return typeof valor === "object" && valor !== null && "clave" in valor && "alias" in valor;
}

export function textoDeValor(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "boolean") return valor ? "sí" : "no";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "string") return valor === "" ? null : valor;
  if (Array.isArray(valor)) {
    const partes = valor.map(textoDeValor).filter((p): p is string => p !== null);
    return partes.length ? partes.join(", ") : null;
  }
  if (esSitio(valor)) return [valor.clave, valor.alias].filter(Boolean).join(" — ");
  return JSON.stringify(valor);
}

// El historial guarda el nombre del archivo, nunca la URL de descarga (lleva token).
export function textoDocumentos(valor: unknown): string | null {
  if (!Array.isArray(valor)) return null;
  const nombres = valor
    .filter((u): u is string => typeof u === "string")
    .map((u) => nombreDeUrl(u) || "archivo sin nombre");
  return nombres.length ? nombres.join(", ") : null;
}

// Compara solo los campos vigilados que vienen en `despues`; omite los que no cambian.
export function calcularCambios(antes: Ticket, despues: Partial<Ticket>, campos: CampoVigilado[]): CambioCampo[] {
  const cambios: CambioCampo[] = [];
  for (const { campo, etiqueta, formato = textoDeValor } of campos) {
    if (!(campo in despues)) continue;
    const valorAntes = formato(antes[campo]);
    const valorDespues = formato(despues[campo]);
    if (valorAntes === valorDespues) continue;
    cambios.push({ campo, etiqueta, antes: valorAntes, despues: valorDespues });
  }
  return cambios;
}
