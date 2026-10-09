export type TipoContrato = "docx" | "pdf";

export function tipoContrato(nombre: string): TipoContrato | null {
  const n = nombre.toLowerCase();
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".pdf")) return "pdf";
  return null;
}

export const esArchivoContrato = (nombre: string): boolean => tipoContrato(nombre) !== null;
