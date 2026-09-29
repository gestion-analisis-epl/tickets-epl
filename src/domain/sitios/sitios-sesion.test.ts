import { describe, expect, it, vi } from "vitest";
import { crearCacheSesionSitios, type AlmacenSesion } from "./sitios-sesion";
import type { ResultadoSitios } from "./sitios-cache";

const RESULTADO: ResultadoSitios = {
  sitios: [{ clave: "C1", alias: "A" }],
  desactualizado: false,
};
const TTL = 30 * 60 * 1000;

function almacenEnMemoria(): AlmacenSesion & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
  };
}

function setup(cargar: () => Promise<ResultadoSitios>, almacen: AlmacenSesion | null = almacenEnMemoria()) {
  let ahora = 1_000_000;
  const crear = () => crearCacheSesionSitios({ cargar, almacen, ttlMs: TTL, ahora: () => ahora });
  return { cache: crear(), crear, avanzar: (ms: number) => { ahora += ms; } };
}

describe("crearCacheSesionSitios", () => {
  it("la primera lectura carga y las siguientes salen de memoria", async () => {
    const cargar = vi.fn().mockResolvedValue(RESULTADO);
    const { cache } = setup(cargar);

    await cache.leer();
    await cache.leer();

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("una pagina recien abierta reutiliza lo guardado en la sesion sin volver a cargar", async () => {
    const cargar = vi.fn().mockResolvedValue(RESULTADO);
    const { crear } = setup(cargar);

    await crear().leer();
    const otraCarga = crear(); // memoria vacia, mismo almacen de sesion
    const resultado = await otraCarga.leer();

    expect(cargar).toHaveBeenCalledTimes(1);
    expect(resultado.sitios).toEqual(RESULTADO.sitios);
  });

  it("recarga cuando vence el TTL", async () => {
    const cargar = vi.fn().mockResolvedValue(RESULTADO);
    const { cache, avanzar } = setup(cargar);

    await cache.leer();
    avanzar(TTL);
    await cache.leer();

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("forzar ignora la copia y vuelve a cargar", async () => {
    const cargar = vi.fn().mockResolvedValue(RESULTADO);
    const { cache } = setup(cargar);

    await cache.leer();
    await cache.leer({ forzar: true });

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("las lecturas simultaneas comparten una sola carga", async () => {
    const cargar = vi.fn().mockResolvedValue(RESULTADO);
    const { cache } = setup(cargar);

    await Promise.all([cache.leer(), cache.leer(), cache.leer()]);

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("si la recarga falla sirve la copia vencida marcada como desactualizada", async () => {
    const cargar = vi.fn().mockResolvedValueOnce(RESULTADO).mockRejectedValueOnce(new Error("sin red"));
    const { cache, avanzar } = setup(cargar);

    await cache.leer();
    avanzar(TTL);
    const resultado = await cache.leer();

    expect(resultado).toEqual({ sitios: RESULTADO.sitios, desactualizado: true });
  });

  it("propaga el error si falla y no hay ninguna copia", async () => {
    const { cache } = setup(vi.fn().mockRejectedValue(new Error("sin red")));
    await expect(cache.leer()).rejects.toThrow("sin red");
  });

  it("no guarda en la sesion un resultado desactualizado del servidor", async () => {
    const almacen = almacenEnMemoria();
    const cargar = vi.fn().mockResolvedValue({ ...RESULTADO, desactualizado: true });
    const { cache } = setup(cargar, almacen);

    await cache.leer();

    expect(almacen.datos.size).toBe(0);
  });

  it("ignora una copia de sesion corrupta y carga de nuevo", async () => {
    const almacen = almacenEnMemoria();
    almacen.setItem("epl.sitios.v2", "{no es json");
    const cargar = vi.fn().mockResolvedValue(RESULTADO);
    const { cache } = setup(cargar, almacen);

    await cache.leer();

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("sigue funcionando en memoria si sessionStorage falla al escribir", async () => {
    const almacen: AlmacenSesion = {
      getItem: () => null,
      setItem: () => { throw new Error("cuota excedida"); },
      removeItem: () => {},
    };
    const cargar = vi.fn().mockResolvedValue(RESULTADO);
    const { cache } = setup(cargar, almacen);

    await cache.leer();
    await cache.leer();

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("funciona sin almacen de sesion (render en servidor)", async () => {
    const cargar = vi.fn().mockResolvedValue(RESULTADO);
    const { cache } = setup(cargar, null);

    await cache.leer();
    await cache.leer();

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("invalidar borra memoria y sesion", async () => {
    const almacen = almacenEnMemoria();
    const cargar = vi.fn().mockResolvedValue(RESULTADO);
    const { cache } = setup(cargar, almacen);

    await cache.leer();
    cache.invalidar();
    await cache.leer();

    expect(cargar).toHaveBeenCalledTimes(2);
  });
});
