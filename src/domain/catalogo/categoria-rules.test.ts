import { describe, it, expect } from "vitest";
import { siguienteOrden, categoriasPendientesDeImportar } from "./categoria-rules";
import type { CategoriaCatalogo, CategoriaInput } from "./categoria";

function categoria(nombre: string, orden: number): CategoriaCatalogo {
  return { id: nombre, nombre, tono: "gray", orden };
}

describe("siguienteOrden", () => {
  it("regresa 0 cuando no hay ninguna categoria existente", () => {
    expect(siguienteOrden([])).toBe(0);
  });

  it("continua a partir del orden mas alto, no del conteo", () => {
    expect(siguienteOrden([categoria("A", 0), categoria("B", 3)])).toBe(4);
  });
});

describe("categoriasPendientesDeImportar", () => {
  const seed: CategoriaInput[] = [
    { nombre: "Contratos", tono: "blue" },
    { nombre: "Arrendamientos", tono: "purple" },
  ];

  it("regresa todo el seed cuando nada existe todavia", () => {
    expect(categoriasPendientesDeImportar(seed, new Set())).toEqual(seed);
  });

  it("excluye por nombre las categorias que ya existen", () => {
    const pendientes = categoriasPendientesDeImportar(seed, new Set(["Contratos"]));
    expect(pendientes.map((c) => c.nombre)).toEqual(["Arrendamientos"]);
  });

  it("regresa vacio cuando todo el seed ya existe", () => {
    const pendientes = categoriasPendientesDeImportar(seed, new Set(seed.map((c) => c.nombre)));
    expect(pendientes).toEqual([]);
  });
});
