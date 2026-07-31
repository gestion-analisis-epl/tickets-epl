export interface Abogado {
  id: string; // igual al string que ya se guardaba en Ticket.abogadoAsignadoId — sin esto, migrar tickets existentes
  nombre: string;
  puesto: string;
  zona?: string;
}

// Transcrito de la hoja "Listas" del Excel original (columna "Abogado
// asignado"), separado en nombre/puesto/zona para el desplegable de
// asignacion (ver ticket-detail.tsx).
export const ABOGADOS: Abogado[] = [
  { id: "Alejandra Ramirez - Gerente Juridico", nombre: "Alejandra Ramirez", puesto: "Gerente Juridico" },
  { id: "Andres Medina - Mesa de Control", nombre: "Andres Medina", puesto: "Mesa de Control" },
  { id: "Karina Valenzuela - Abogado Corporativo", nombre: "Karina Valenzuela", puesto: "Abogado Corporativo" },
  { id: "Jessica Valadez - Abogado Comercial", nombre: "Jessica Valadez", puesto: "Abogado Comercial" },
  { id: "Alberto Gonzalez - Regional - Puebla-Sur", nombre: "Alberto Gonzalez", puesto: "Regional", zona: "Puebla-Sur" },
  { id: "Beatriz Gonzalez - Regional", nombre: "Beatriz Gonzalez", puesto: "Regional" },
  { id: "Alejandro Villanueva - Regional - Bajio N/S", nombre: "Alejandro Villanueva", puesto: "Regional", zona: "Bajio N/S" },
  { id: "Alfredo Gonzalez - Regional - Norte Pacifico-Occidente", nombre: "Alfredo Gonzalez", puesto: "Regional", zona: "Norte Pacifico-Occidente" },
  { id: "Concepcion Madrigal - Aux. Gestion Documental y Pagos", nombre: "Concepcion Madrigal", puesto: "Aux. Gestion Documental y Pagos" },
];

export function findAbogado(id: string | null | undefined): Abogado | undefined {
  if (!id) return undefined;
  return ABOGADOS.find((a) => a.id === id);
}
