import { describe, expect, it, vi } from "vitest";
import { crearLectorSitios } from "./sitios-cache";
import type { Sitio } from "./sitios-rules";

const SITIOS: Sitio[] = [{ clave: "C1", alias: "A" }];
const TTL = 5 * 60 * 1000;

function setup(cargar: () => Promise<Sitio[]>) {
  let ahora = 1_000_000;
  const lector = crearLectorSitios({ cargar, ttlMs: TTL, ahora: () => ahora });
  return { lector, avanzar: (ms: number) => { ahora += ms; } };
}

describe("crearLectorSitios", () => {
  it("reutiliza el resultado dentro del TTL", async () => {
    const cargar = vi.fn().mockResolvedValue(SITIOS);
    const { lector, avanzar } = setup(cargar);

    await lector();
    avanzar(TTL - 1);
    await lector();

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it("vuelve a cargar cuando vence el TTL", async () => {
    const cargar = vi.fn().mockResolvedValue(SITIOS);
    const { lector, avanzar } = setup(cargar);

    await lector();
    avanzar(TTL);
    await lector();

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it("si la recarga falla sirve la ultima copia buena marcada como desactualizada", async () => {
    const cargar = vi.fn().mockResolvedValueOnce(SITIOS).mockRejectedValueOnce(new Error("Sheets caido"));
    const { lector, avanzar } = setup(cargar);

    await lector();
    avanzar(TTL);
    const resultado = await lector();

    expect(resultado).toEqual({ sitios: SITIOS, desactualizado: true });
  });

  it("marca como actualizado un resultado recien cargado", async () => {
    const { lector } = setup(vi.fn().mockResolvedValue(SITIOS));
    expect(await lector()).toEqual({ sitios: SITIOS, desactualizado: false });
  });

  it("propaga el error si falla y no hay copia previa", async () => {
    const { lector } = setup(vi.fn().mockRejectedValue(new Error("Sheets caido")));
    await expect(lector()).rejects.toThrow("Sheets caido");
  });

  it("no cachea los fallos: el siguiente intento vuelve a cargar", async () => {
    const cargar = vi.fn().mockRejectedValueOnce(new Error("Sheets caido")).mockResolvedValueOnce(SITIOS);
    const { lector } = setup(cargar);

    await expect(lector()).rejects.toThrow();
    expect(await lector()).toEqual({ sitios: SITIOS, desactualizado: false });
  });

  it("las llamadas simultaneas comparten una sola carga", async () => {
    const cargar = vi.fn().mockResolvedValue(SITIOS);
    const { lector } = setup(cargar);

    await Promise.all([lector(), lector(), lector()]);

    expect(cargar).toHaveBeenCalledTimes(1);
  });
});
