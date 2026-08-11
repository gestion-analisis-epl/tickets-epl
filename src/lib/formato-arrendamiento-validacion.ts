import { MARCADORES_FORMATO_ARRENDAMIENTO, MARCADORES_MINIMOS_REQUERIDOS } from "./data/arrendamientos-temporal";

export function validarTextoFormatoArrendamiento(texto: string): boolean {
  const coincidencias = MARCADORES_FORMATO_ARRENDAMIENTO.filter((marcador) => marcador.test(texto)).length;
  return coincidencias >= MARCADORES_MINIMOS_REQUERIDOS;
}
