import type { CategoriaCatalogo, CategoriaInput } from "./categoria";

export function siguienteOrden(existentes: CategoriaCatalogo[]): number {
  return existentes.reduce((max, c) => Math.max(max, c.orden), -1) + 1;
}

export function categoriasPendientesDeImportar(seed: CategoriaInput[], nombresExistentes: Set<string>): CategoriaInput[] {
  return seed.filter((c) => !nombresExistentes.has(c.nombre));
}
