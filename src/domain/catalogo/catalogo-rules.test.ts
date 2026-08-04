import { describe, it, expect } from "vitest";
import { siguienteId, serviciosPendientesDeImportar } from "./catalogo-rules";
import type { CatalogoServicio } from "@/types/catalogo";

function servicio(id: string): CatalogoServicio {
  return {
    id,
    puestoResponsable: "Mesa de Control",
    servicio: `Servicio ${id}`,
    solicitanteTipico: "Areas internas",
    categoria: "Control documental",
    slaInterno: 1,
    slaDespachoRef: 3,
  };
}

describe("siguienteId", () => {
  it("regresa el primer id de la serie cuando no hay ninguno existente", () => {
    expect(siguienteId([])).toBe("JUR-C001");
  });

  it("continua la serie a partir del id mas alto", () => {
    expect(siguienteId(["JUR-C001", "JUR-C002"])).toBe("JUR-C003");
  });

  it("usa el maximo, no el conteo, cuando hay huecos en la serie", () => {
    expect(siguienteId(["JUR-C001", "JUR-C005"])).toBe("JUR-C006");
  });

  it("ignora ids que no siguen el formato JUR-C### al buscar el maximo", () => {
    expect(siguienteId(["JUR-C001", "id-invalido"])).toBe("JUR-C002");
  });
});

describe("serviciosPendientesDeImportar", () => {
  const seed = [servicio("JUR-C001"), servicio("JUR-C002"), servicio("JUR-C003")];

  it("regresa todo el seed cuando nada existe todavia", () => {
    expect(serviciosPendientesDeImportar(seed, new Set())).toEqual(seed);
  });

  it("excluye los ids que ya existen en el destino", () => {
    const pendientes = serviciosPendientesDeImportar(seed, new Set(["JUR-C001"]));
    expect(pendientes.map((s) => s.id)).toEqual(["JUR-C002", "JUR-C003"]);
  });

  it("regresa vacio cuando todo el seed ya existe", () => {
    const pendientes = serviciosPendientesDeImportar(seed, new Set(seed.map((s) => s.id)));
    expect(pendientes).toEqual([]);
  });
});
