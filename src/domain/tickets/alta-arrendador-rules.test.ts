import { describe, it, expect } from "vitest";
import { DOMICILIO_VACIO, documentosAltaRequeridos, domicilioTexto, validarAlta } from "./alta-arrendador-rules";

const DOM = { calle: "Reforma", numero: "10", interior: "", colonia: "Centro", municipio: "Queretaro", estado: "Qro", cp: "76000", entreCalles: "A y B" };

describe("documentosAltaRequeridos", () => {
  it("el contrato anterior solo se pide en cambio", () => {
    expect(documentosAltaRequeridos("nuevo").map((d) => d.key)).not.toContain("contratoAnterior");
    expect(documentosAltaRequeridos("cambio").map((d) => d.key)).toContain("contratoAnterior");
  });
});

describe("domicilioTexto", () => {
  it("arma el texto sin el interior vacio", () => {
    expect(domicilioTexto(DOM)).toBe("Reforma 10, Col. Centro, Queretaro, Qro, CP 76000, entre A y B");
  });
  it("incluye el interior cuando existe", () => {
    expect(domicilioTexto({ ...DOM, interior: "3" })).toContain("Int. 3");
  });
});

describe("validarAlta", () => {
  it("una alta nueva completa no tiene errores", () => {
    expect(validarAlta({ tipoAlta: "nuevo", motivoCambio: "", domicilio: DOM })).toEqual({});
  });
  it("exige el tipo de alta", () => {
    expect(validarAlta({ tipoAlta: "", motivoCambio: "", domicilio: DOM }).tipoAlta).toBeTruthy();
  });
  it("exige el motivo solo si es cambio", () => {
    expect(validarAlta({ tipoAlta: "cambio", motivoCambio: " ", domicilio: DOM }).motivoCambio).toBeTruthy();
    expect(validarAlta({ tipoAlta: "nuevo", motivoCambio: "", domicilio: DOM }).motivoCambio).toBeUndefined();
  });
  it("exige cada campo del domicilio salvo el interior", () => {
    const e = validarAlta({ tipoAlta: "nuevo", motivoCambio: "", domicilio: DOMICILIO_VACIO });
    expect(Object.keys(e)).toEqual(expect.arrayContaining(["calle", "numero", "colonia", "municipio", "estado", "cp", "entreCalles"]));
    expect(e.interior).toBeUndefined();
  });
});
