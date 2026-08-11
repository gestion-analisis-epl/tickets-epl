import type { CatalogoServicio } from "@/types/catalogo";

export interface CatalogoLookup {
  findServicio(servicioId: string): CatalogoServicio | undefined;
}
