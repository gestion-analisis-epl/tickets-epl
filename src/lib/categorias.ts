import { firestoreCategoriaRepository } from "@/infrastructure/firestore/categoria-repository";
import { createCategoriaService } from "@/domain/catalogo/categoria-service";
import { CATEGORIAS_SEED, type CategoriaInput } from "@/domain/catalogo/categoria";
import { useCategoriasStore } from "@/stores/categorias";
import type { Unsubscribe } from "@/domain/catalogo/categoria-repository";

export type { CategoriaInput, CategoriaCatalogo } from "@/domain/catalogo/categoria";
export type { ImportarCategoriasResultado } from "@/domain/catalogo/categoria-service";

const categoriaService = createCategoriaService(firestoreCategoriaRepository);

export function subscribeCategorias(): Unsubscribe {
  return categoriaService.subscribe((categorias) => useCategoriasStore.getState().setCategorias(categorias));
}

// Lectura sincrona desde el cache en memoria — mismo criterio que
// findServicio en lib/catalogo.ts (usado por CategoriaBadge).
export function findCategoria(nombre: string) {
  return useCategoriasStore.getState().categorias.find((c) => c.nombre === nombre);
}

export function crearCategoria(input: CategoriaInput): Promise<void> {
  return categoriaService.crearCategoria(input, useCategoriasStore.getState().categorias);
}

export const actualizarTonoCategoria = categoriaService.actualizarTono;
export const eliminarCategoria = categoriaService.eliminarCategoria;

export function importarCategoriasEstaticas() {
  return categoriaService.importarCategoriasEstaticas(CATEGORIAS_SEED);
}
