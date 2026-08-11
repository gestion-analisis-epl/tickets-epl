import { firestoreCatalogoRepository } from "@/infrastructure/firestore/catalogo-repository";
import { createCatalogoService } from "@/domain/catalogo/catalogo-service";
import { CATALOGO_SERVICIOS_SEED } from "./data/catalogo-servicios";
import { useCatalogoStore } from "@/stores/catalogo";
import type { CatalogoServicio } from "@/types/catalogo";
import type { ServicioInput, Unsubscribe } from "@/domain/catalogo/catalogo-repository";

export type { ServicioInput } from "@/domain/catalogo/catalogo-repository";
export type { ImportarResultado } from "@/domain/catalogo/catalogo-service";

const catalogoService = createCatalogoService(firestoreCatalogoRepository);

export function subscribeCatalogo(): Unsubscribe {
  return catalogoService.subscribe((servicios) => useCatalogoStore.getState().setServicios(servicios));
}

// Lectura sincrona desde el cache en memoria (poblado por subscribeCatalogo).
export function findServicio(servicioId: string): CatalogoServicio | undefined {
  return useCatalogoStore.getState().servicios.find((s) => s.id === servicioId);
}

export function crearServicio(input: ServicioInput): Promise<string> {
  const idsExistentes = useCatalogoStore.getState().servicios.map((s) => s.id);
  return catalogoService.crearServicio(input, idsExistentes);
}

export const actualizarServicio = catalogoService.actualizarServicio;
export const eliminarServicio = catalogoService.eliminarServicio;

export function importarCatalogoEstatico() {
  return catalogoService.importarCatalogoEstatico(CATALOGO_SERVICIOS_SEED);
}
