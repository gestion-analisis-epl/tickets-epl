import type { CatalogoServicio, Categoria } from "@/types/catalogo";

export type Unsubscribe = () => void;

export interface ServicioInput {
  puestoResponsable: string;
  servicio: string;
  solicitanteTipico: string;
  categoria: Categoria;
  slaInterno: number;
  slaDespachoRef: number;
}

export interface CatalogoRepository {
  subscribe(callback: (servicios: CatalogoServicio[]) => void): Unsubscribe;
  create(id: string, input: ServicioInput): Promise<void>;
  update(id: string, input: ServicioInput): Promise<void>;
  delete(id: string): Promise<void>;
  listIds(): Promise<string[]>;
}
