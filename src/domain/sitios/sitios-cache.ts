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

export function crearLectorSitios({ cargar, ttlMs, ahora = Date.now }: Opciones): () => Promise<ResultadoSitios> {
  let copia: { sitios: Sitio[]; cargadoEn: number } | null = null;
  let enCurso: Promise<ResultadoSitios> | null = null;

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

  return async function leer() {
    if (copia && ahora() - copia.cargadoEn < ttlMs) return { sitios: copia.sitios, desactualizado: false };
    // Las llamadas simultaneas comparten la misma carga.
    enCurso ??= refrescar().finally(() => { enCurso = null; });
    return enCurso;
  };
}
