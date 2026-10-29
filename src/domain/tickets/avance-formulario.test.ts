import { describe, it, expect } from "vitest";
import { faltantesPorSeccion, textoFaltan, totalFaltantes } from "./avance-formulario";

const SECCIONES = [
  { id: "s-solicitud", titulo: "Solicitud", claves: ["areaEmpresa", "servicioId", "sitio", "descripcion"] },
  { id: "s-contrato", titulo: "Contrato", claves: ["domicilio", "montoPago"] },
  { id: "s-docs", titulo: "Documentos" },
];

describe("faltantesPorSeccion", () => {
  it("sin errores todas las secciones quedan en cero", () => {
    expect(faltantesPorSeccion({}, SECCIONES).map((s) => s.faltan)).toEqual([0, 0, 0]);
  });

  it("cuenta cada error en la seccion que lo reclama", () => {
    const r = faltantesPorSeccion({ areaEmpresa: "x", descripcion: "x", montoPago: "x" }, SECCIONES);
    expect(r.map((s) => s.faltan)).toEqual([2, 1, 0]);
  });

  it("los errores que nadie reclama (documentos sueltos) van a la seccion sin claves", () => {
    const r = faltantesPorSeccion({ formato: "x", predial: "x", domicilio: "x" }, SECCIONES);
    expect(r.map((s) => s.faltan)).toEqual([0, 1, 2]);
  });

  it("ignora los errores vacios", () => {
    expect(totalFaltantes(faltantesPorSeccion({ areaEmpresa: "", predial: "" }, SECCIONES))).toBe(0);
  });

  it("conserva el id y el titulo de cada seccion", () => {
    expect(faltantesPorSeccion({}, SECCIONES)[1]).toEqual({ id: "s-contrato", titulo: "Contrato", faltan: 0 });
  });
});

describe("totalFaltantes y textoFaltan", () => {
  it("suma las secciones", () => {
    expect(totalFaltantes([{ id: "a", titulo: "A", faltan: 2 }, { id: "b", titulo: "B", faltan: 3 }])).toBe(5);
  });
  it("redacta en singular y plural", () => {
    expect(textoFaltan(0)).toBe("Listo");
    expect(textoFaltan(1)).toBe("Falta 1 dato");
    expect(textoFaltan(4)).toBe("Faltan 4 datos");
  });
});
