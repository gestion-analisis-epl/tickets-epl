import type { CatalogoServicio } from "@/types/catalogo";

// Puerto minimo que el dominio de tickets necesita del catalogo: una lectura
// sincrona por id. No sabe que hoy eso vive en un cache en memoria poblado
// desde Firestore (ver lib/catalogo.ts / CatalogoProvider).
export interface CatalogoLookup {
  findServicio(servicioId: string): CatalogoServicio | undefined;
}
