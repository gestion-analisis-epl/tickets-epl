// Busqueda sin distinguir mayusculas ni acentos ("garcia" encuentra "García").
export function normalizar(v: unknown): string {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
