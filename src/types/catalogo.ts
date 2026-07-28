export type Categoria =
  | "Contratos"
  | "Licencias y permisos"
  | "Control documental"
  | "Servicios extraordinarios";

export interface CatalogoServicio {
  id: string; // JUR-C001 ... JUR-C070
  puestoResponsable: string;
  servicio: string;
  solicitanteTipico: string;
  categoria: Categoria;
  slaInterno: number;      // dias habiles
  slaDespachoRef: number;  // dias habiles
}
