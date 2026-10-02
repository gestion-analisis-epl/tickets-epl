import { describe, expect, it } from "vitest";
import { guardarSesion, leerSesion, type AlmacenSesion } from "./session-storage";

function almacen(): AlmacenSesion & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return { datos, getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) };
}

describe("sesion", () => {
  it("devuelve lo guardado", () => {
    const a = almacen();
    guardarSesion("k", { x: [1, 2] }, a);
    expect(leerSesion("k", {}, a)).toEqual({ x: [1, 2] });
  });

  it("devuelve el valor inicial si no hay nada o esta corrupto", () => {
    const a = almacen();
    expect(leerSesion("k", "base", a)).toBe("base");
    a.datos.set("k", "{no es json");
    expect(leerSesion("k", "base", a)).toBe("base");
  });

  it("no truena si el almacen falla o no existe", () => {
    const roto: AlmacenSesion = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(leerSesion("k", "base", roto)).toBe("base");
    expect(() => guardarSesion("k", 1, roto)).not.toThrow();
    expect(leerSesion("k", "base", undefined)).toBe("base");
  });
});
