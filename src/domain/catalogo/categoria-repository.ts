import type { CategoriaCatalogo, CategoriaInput } from "./categoria";

export type Unsubscribe = () => void;

export interface CategoriaRepository {
  subscribe(callback: (categorias: CategoriaCatalogo[]) => void): Unsubscribe;
  create(input: CategoriaInput, orden: number): Promise<void>;
  update(id: string, input: Pick<CategoriaInput, "tono">): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<CategoriaCatalogo[]>;
}
