import type { CatalogoServicio } from "@/types/catalogo";

export function siguienteId(existentes: string[]): string {
  const max = existentes.reduce((m, id) => {
    const n = Number(id.replace("JUR-C", ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `JUR-C${String(max + 1).padStart(3, "0")}`;
}

export function serviciosPendientesDeImportar(seed: CatalogoServicio[], existentes: Set<string>): CatalogoServicio[] {
  return seed.filter((s) => !existentes.has(s.id));
}
