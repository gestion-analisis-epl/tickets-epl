import type { CategoriaRepository } from "./categoria-repository";
import { siguienteOrden, categoriasPendientesDeImportar } from "./categoria-rules";
import type { CategoriaCatalogo, CategoriaInput } from "./categoria";

export interface ImportarCategoriasResultado {
  importadas: number;
  omitidas: number;
}

export function createCategoriaService(repo: CategoriaRepository) {
  function subscribe(callback: (categorias: CategoriaCatalogo[]) => void) {
    return repo.subscribe(callback);
  }

  async function crearCategoria(input: CategoriaInput, existentes: CategoriaCatalogo[]): Promise<void> {
    await repo.create(input, siguienteOrden(existentes));
  }

  async function actualizarTono(id: string, tono: CategoriaInput["tono"]): Promise<void> {
    await repo.update(id, { tono });
  }

  async function eliminarCategoria(id: string): Promise<void> {
    await repo.delete(id);
  }

  // Boton de un solo uso en /catalogo (solo admin): siembra las 5 categorias
  // que antes eran el union type fijo. Idempotente por nombre.
  async function importarCategoriasEstaticas(seed: CategoriaInput[]): Promise<ImportarCategoriasResultado> {
    const existentes = await repo.list();
    const pendientes = categoriasPendientesDeImportar(seed, new Set(existentes.map((c) => c.nombre)));

    let acumulado = existentes;
    for (const c of pendientes) {
      const orden = siguienteOrden(acumulado);
      await repo.create(c, orden);
      acumulado = [...acumulado, { id: c.nombre, nombre: c.nombre, tono: c.tono, orden }];
    }

    return { importadas: pendientes.length, omitidas: seed.length - pendientes.length };
  }

  return { subscribe, crearCategoria, actualizarTono, eliminarCategoria, importarCategoriasEstaticas };
}
