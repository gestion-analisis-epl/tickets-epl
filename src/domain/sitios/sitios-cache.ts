import type { Sitio } from "./sitios-rules";

export interface ResultadoSitios {
  sitios: Sitio[];
  // true cuando la recarga fallo y se sirve la ultima copia buena.
  desactualizado: boolean;
}

interface Opciones {
  cargar: () => Promise<Sitio[]>;
  ttlMs: number;
  ahora?: () => number;
}

export function crearLectorSitios({
  cargar,
  ttlMs,
  ahora = Date.now,
}: Opciones): (opciones?: { forzar?: boolean }) => Promise<ResultadoSitios> {
  let copia: { sitios: Sitio[]; cargadoEn: number } | null = null;
  let enCurso: Promise<ResultadoSitios> | null = null;

  // "Actualizar catalogo" se salta el TTL, pero no mas de una vez cada tanto: evita saturar la hoja.
  const ESPERA_MIN_FORZAR_MS = 15 * 1000;

  async function refrescar(): Promise<ResultadoSitios> {
    try {
      const sitios = await cargar();
      copia = { sitios, cargadoEn: ahora() };
      return { sitios, desactualizado: false };
    } catch (err) {
      if (copia) return { sitios: copia.sitios, desactualizado: true };
      throw err;
    }
  }

  return async function leer({ forzar = false }: { forzar?: boolean } = {}) {
    const vigenteMs = forzar ? ESPERA_MIN_FORZAR_MS : ttlMs;
    if (copia && ahora() - copia.cargadoEn < vigenteMs) return { sitios: copia.sitios, desactualizado: false };
    // Las llamadas simultaneas comparten la misma carga.
    enCurso ??= refrescar().finally(() => { enCurso = null; });
    return enCurso;
  };
}
