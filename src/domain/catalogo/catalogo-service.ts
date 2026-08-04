import type { CatalogoRepository, ServicioInput } from "./catalogo-repository";
import { siguienteId, serviciosPendientesDeImportar } from "./catalogo-rules";
import type { CatalogoServicio } from "@/types/catalogo";

export interface ImportarResultado {
  importados: number;
  omitidos: number;
}

export function createCatalogoService(repo: CatalogoRepository) {
  function subscribe(callback: (servicios: CatalogoServicio[]) => void) {
    return repo.subscribe(callback);
  }

  async function crearServicio(input: ServicioInput, idsExistentes: string[]): Promise<string> {
    const id = siguienteId(idsExistentes);
    await repo.create(id, input);
    return id;
  }

  async function actualizarServicio(id: string, input: ServicioInput): Promise<void> {
    await repo.update(id, input);
  }

  async function eliminarServicio(id: string): Promise<void> {
    await repo.delete(id);
  }

  // Boton de un solo uso en /catalogo (solo admin): copia el catalogo estatico
  // original a Firestore. Idempotente — salta los ids que ya existan alla.
  async function importarCatalogoEstatico(seed: CatalogoServicio[]): Promise<ImportarResultado> {
    const ids = await repo.listIds();
    const pendientes = serviciosPendientesDeImportar(seed, new Set(ids));

    for (const s of pendientes) {
      const { id, ...datos } = s;
      await repo.create(id, datos);
    }

    return { importados: pendientes.length, omitidos: seed.length - pendientes.length };
  }

  return { subscribe, crearServicio, actualizarServicio, eliminarServicio, importarCatalogoEstatico };
}
