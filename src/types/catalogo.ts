// Nombre de una categoria (ver domain/catalogo/categoria.ts) — ya no es un
// union fijo: las categorias viven en Firestore y se administran desde
// /catalogo, para poder agregar una nueva sin deploy. El nombre es el valor
// que se guarda aqui y en Ticket.categoria (no el id del doc), asi que
// renombrar una categoria existente no actualiza en cascada los servicios/
// tickets que ya la usaban (mismo criterio que ya aplica al reasignar un
// abogado o cambiar el texto de un servicio).
export type Categoria = string;

export interface CatalogoServicio {
  id: string; // JUR-C001 ... JUR-C070
  puestoResponsable: string;
  servicio: string;
  solicitanteTipico: string;
  categoria: Categoria;
  slaInterno: number;      // dias habiles
  slaDespachoRef: number;  // dias habiles
}
