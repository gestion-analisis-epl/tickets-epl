export interface SeccionAvance {
  id: string;
  titulo: string;
  faltan: number;
}

interface SeccionDefinida {
  id: string;
  titulo: string;
  // Claves de error que le tocan. Sin claves, recibe los errores que ninguna otra seccion reclama.
  claves?: string[];
}

// Reparte los errores de validacion por seccion para avisar "Faltan N datos".
export function faltantesPorSeccion(errores: Record<string, string>, secciones: SeccionDefinida[]): SeccionAvance[] {
  const claves = Object.keys(errores).filter((k) => errores[k]);
  const reclamadas = new Set(secciones.flatMap((s) => s.claves ?? []));
  const sobrantes = claves.filter((k) => !reclamadas.has(k)).length;

  return secciones.map(({ id, titulo, claves: propias }) => ({
    id,
    titulo,
    faltan: propias ? claves.filter((k) => propias.includes(k)).length : sobrantes,
  }));
}

export function totalFaltantes(secciones: SeccionAvance[]): number {
  return secciones.reduce((suma, s) => suma + s.faltan, 0);
}

export function textoFaltan(n: number): string {
  if (n === 0) return "Listo";
  return n === 1 ? "Falta 1 dato" : `Faltan ${n} datos`;
}
