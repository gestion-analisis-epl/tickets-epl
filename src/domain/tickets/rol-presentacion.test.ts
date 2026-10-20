import { describe, it, expect } from "vitest";
import { ETIQUETA_ROL, etiquetaRol, tokenColorRol } from "./rol-presentacion";
import { formatFechaHora, textoLegibleDeValor } from "@/lib/format-fecha";

describe("presentacion por rol", () => {
  it("cada rol tiene etiqueta y un color propio", () => {
    const tokens = Object.keys(ETIQUETA_ROL).map(tokenColorRol);
    expect(new Set(tokens).size).toBe(tokens.length);
  });
  it("un rol desconocido usa el color neutro y su propio texto", () => {
    expect(tokenColorRol("otro_rol")).toBe("rol-otro");
    expect(etiquetaRol("otro_rol")).toBe("otro_rol");
  });
});

describe("fechas del historial", () => {
  it("dd/mm/aaaa HH:mm en hora de Ciudad de Mexico", () => {
    expect(formatFechaHora("2026-10-20T15:02:20.000Z")).toBe("20/10/2026 09:02");
  });
  it("convierte fechas ISO dentro de los valores, sin tocar el resto", () => {
    expect(textoLegibleDeValor("2026-10-20T15:02:20.000Z")).toBe("20/10/2026 09:02");
    expect(textoLegibleDeValor("2027-01-05")).toBe("05/01/2027");
    expect(textoLegibleDeValor("Av. Reforma 1")).toBe("Av. Reforma 1");
    expect(textoLegibleDeValor(null)).toBeNull();
  });
});
