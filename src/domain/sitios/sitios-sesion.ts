import type { ResultadoSitios } from "./sitios-cache";
import type { Sitio } from "./sitios-rules";

// Subconjunto de Storage que necesitamos (sessionStorage en el navegador).
export interface AlmacenSesion {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

interface Opciones {
  cargar: () => Promise<ResultadoSitios>;
  almacen: AlmacenSesion | null;
  ttlMs: number;
  ahora?: () => number;
}

interface Copia {
  sitios: Sitio[];
  cargadoEn: number;
}

const CLAVE_ALMACEN = "epl.sitios.v2";

function esCopiaValida(x: unknown): x is Copia {
  const c = x as Copia | null;
  return !!c && typeof c.cargadoEn === "number" && Array.isArray(c.sitios);
}

// Carga completa del catalogo una sola vez y la conserva durante la sesion del navegador,
// para no pedir la hoja cada vez que se abre un formulario.
export function crearCacheSesionSitios({ cargar, almacen, ttlMs, ahora = Date.now }: Opciones) {
  let memoria: Copia | null = null;
  let enCurso: Promise<ResultadoSitios> | null = null;

  function leerAlmacen(): Copia | null {
    try {
      const crudo = almacen?.getItem(CLAVE_ALMACEN);
      if (!crudo) return null;
      const copia: unknown = JSON.parse(crudo);
      return esCopiaValida(copia) ? copia : null;
    } catch {
      return null;
    }
  }

  function guardar(copia: Copia) {
    memoria = copia;
    try {
      almacen?.setItem(CLAVE_ALMACEN, JSON.stringify(copia));
    } catch {
      // Cuota o modo privado: se sigue con la copia en memoria.
    }
  }

  async function recargar(previa: Copia | null): Promise<ResultadoSitios> {
    try {
      const resultado = await cargar();
      // Una copia que el servidor ya marco como vieja no se conserva: el siguiente intento reintenta.
      if (!resultado.desactualizado) guardar({ sitios: resultado.sitios, cargadoEn: ahora() });
      return resultado;
    } catch (err) {
      if (previa) return { sitios: previa.sitios, desactualizado: true };
      throw err;
    }
  }

  async function leer({ forzar = false }: { forzar?: boolean } = {}): Promise<ResultadoSitios> {
    const copia = memoria ?? leerAlmacen();
    if (copia && !forzar && ahora() - copia.cargadoEn < ttlMs) {
      memoria = copia;
      return { sitios: copia.sitios, desactualizado: false };
    }
    // Las lecturas simultaneas comparten la misma carga.
    enCurso ??= recargar(copia).finally(() => {
      enCurso = null;
    });
    return enCurso;
  }

  function invalidar() {
    memoria = null;
    try {
      almacen?.removeItem(CLAVE_ALMACEN);
    } catch {
      // nada que limpiar
    }
  }

  return { leer, invalidar };
}
