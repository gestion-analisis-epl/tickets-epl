import { describe, it, expect } from "vitest";
import { formaPagoLabel, formatMonto, NO_DISPONIBLE, textoDiscrepancia, textoODisponible } from "./resumen-presentacion";

describe("resumen-presentacion", () => {
  it("formatea el monto en pesos mexicanos", () => {
    expect(formatMonto(120000)).toMatch(/120,000\.00/);
    expect(formatMonto(120000)).toContain("$");
  });
  it("pinta null como No disponible", () => {
    expect(formatMonto(null)).toBe(NO_DISPONIBLE);
    expect(formaPagoLabel(null)).toBe(NO_DISPONIBLE);
    expect(textoODisponible(null)).toBe(NO_DISPONIBLE);
    expect(textoODisponible("  ")).toBe(NO_DISPONIBLE);
    expect(textoODisponible("Calle 1")).toBe("Calle 1");
  });
  it("etiqueta la forma de pago", () => {
    expect(formaPagoLabel("bimestral")).toBe("Bimestral");
  });
  it("redacta la discrepancia", () => {
    expect(textoDiscrepancia({ campo: "domicilio", valorContrato: "A", valorTicket: "B" })).toBe(
      "Domicilio: el contrato dice A, el ticket dice B"
    );
  });
});
