import type { BadgeTone } from "@/types/badge";

export interface CategoriaCatalogo {
  id: string; // = nombre (ver categoria-repository), asi que renombrar no aplica: se borra y se crea de nuevo
  nombre: string;
  tono: BadgeTone;
  orden: number;
}

export interface CategoriaInput {
  nombre: string;
  tono: BadgeTone;
}

// Semilla de un solo uso (boton en /catalogo, ver importarCategoriasEstaticas)
// — los 5 valores que antes eran el union type fijo Categoria.
export const CATEGORIAS_SEED: CategoriaInput[] = [
  { nombre: "Servicios extraordinarios", tono: "orange" },
  { nombre: "Control documental", tono: "gray" },
  { nombre: "Contratos", tono: "blue" },
  { nombre: "Licencias y permisos", tono: "teal" },
  { nombre: "Arrendamientos", tono: "purple" },
];
