import { describe, it, expect } from "vitest";
import {
  calcularPatchAltaRetroactiva, documentosAltaIniciales, documentosAltaRequeridos,
  esAltaRetroactiva, validarAlta, validarAltaRetroactiva,
} from "./alta-arrendador-rules";

describe("documentosAltaRequeridos", () => {
  it("el contrato anterior y la personalidad legal solo se piden en cambio", () => {
    const nuevo = documentosAltaRequeridos("nuevo").map((d) => d.key);
    const cambio = documentosAltaRequeridos("cambio").map((d) => d.key);
    expect(nuevo).not.toContain("contratoAnterior");
    expect(nuevo).not.toContain("personalidadLegal");
    expect(cambio).toEqual(expect.arrayContaining(["contratoAnterior", "personalidadLegal"]));
  });
  it("en alta nueva se piden identificaciones, acreditacion de propiedad, predial y comprobante de domicilio", () => {
    expect(documentosAltaRequeridos("nuevo").map((d) => d.key)).toEqual(
      ["identificaciones", "acreditacionPropiedad", "predial", "comprobanteDomicilio"]
    );
  });
});

describe("validarAlta", () => {
  it("una alta nueva completa no tiene errores", () => {
    expect(validarAlta({ tipoAlta: "nuevo", motivoCambio: "" })).toEqual({});
  });
  it("exige el tipo de alta", () => {
    expect(validarAlta({ tipoAlta: "", motivoCambio: "" }).tipoAlta).toBeTruthy();
  });
  it("exige el motivo solo si es cambio", () => {
    expect(validarAlta({ tipoAlta: "cambio", motivoCambio: " " }).motivoCambio).toBeTruthy();
    expect(validarAlta({ tipoAlta: "nuevo", motivoCambio: "" }).motivoCambio).toBeUndefined();
  });
});

describe("esAltaRetroactiva", () => {
  it("un ticket de Alta sin datos de alta o con la marca retroactiva", () => {
    expect(esAltaRetroactiva({ servicioId: "JUR-C071", altaArrendador: undefined })).toBe(true);
    expect(esAltaRetroactiva({ servicioId: "JUR-C071", altaArrendador: { retroactiva: true } as never })).toBe(true);
  });
  it("no si los datos los capturo el solicitante ni en otro servicio", () => {
    expect(esAltaRetroactiva({ servicioId: "JUR-C071", altaArrendador: {} as never })).toBe(false);
    expect(esAltaRetroactiva({ servicioId: "JUR-C072", altaArrendador: undefined })).toBe(false);
  });
});

describe("validarAltaRetroactiva", () => {
  it("exige el tipo de alta, y el motivo solo si es cambio; los documentos son opcionales", () => {
    expect(validarAltaRetroactiva({ tipoAlta: "", motivoCambio: "" }).tipoAlta).toBeTruthy();
    expect(validarAltaRetroactiva({ tipoAlta: "cambio", motivoCambio: " " }).motivoCambio).toBeTruthy();
    expect(validarAltaRetroactiva({ tipoAlta: "nuevo", motivoCambio: "" })).toEqual({});
  });
});

describe("documentosAltaIniciales", () => {
  it("usa los documentos de alta si ya existen", () => {
    expect(documentosAltaIniciales({ altaArrendador: { documentos: { predial: "u" } } as never, documentosArrendamiento: undefined })).toEqual({ predial: "u" });
  });
  it("en un ticket anterior pasa los 4 documentos viejos a su nombre nuevo y omite los vacios", () => {
    expect(documentosAltaIniciales({
      altaArrendador: undefined,
      documentosArrendamiento: { escrituras: "e", identificacionArrendador: "i", predial: "p", comprobanteDomicilio: "" },
    })).toEqual({ acreditacionPropiedad: "e", identificaciones: "i", predial: "p" });
  });
  it("sin documentos viejos queda vacio", () => {
    expect(documentosAltaIniciales({ altaArrendador: undefined, documentosArrendamiento: undefined })).toEqual({});
  });
});

describe("calcularPatchAltaRetroactiva", () => {
  const base = { tipoAlta: "nuevo" as const, motivoCambio: "", geolocalizacion: null, documentos: { predial: "p", identificaciones: "" } };

  it("guarda el bloque con la marca retroactiva, sin llaves vacias ni undefined", () => {
    const patch = calcularPatchAltaRetroactiva(base);
    expect(patch.altaArrendador).toEqual({ tipoAlta: "nuevo", documentos: { predial: "p" }, retroactiva: true });
    expect(Object.values(patch.altaArrendador!).includes(undefined)).toBe(false);
  });
  it("en cambio guarda el motivo; en nuevo lo descarta y descarta el contrato anterior", () => {
    const cambio = calcularPatchAltaRetroactiva({ ...base, tipoAlta: "cambio", motivoCambio: " vendio ", documentos: { contratoAnterior: "c" } });
    expect(cambio.altaArrendador?.motivoCambio).toBe("vendio");
    expect(cambio.altaArrendador?.documentos).toEqual({ contratoAnterior: "c" });
    const nuevo = calcularPatchAltaRetroactiva({ ...base, motivoCambio: "sobra", documentos: { contratoAnterior: "c", personalidadLegal: "p" } });
    expect(nuevo.altaArrendador?.motivoCambio).toBeUndefined();
    expect(nuevo.altaArrendador?.documentos).toEqual({});
  });
  it("incluye la geolocalizacion solo si hay", () => {
    expect(calcularPatchAltaRetroactiva({ ...base, geolocalizacion: "20,-100" }).altaArrendador?.geolocalizacion).toBe("20,-100");
    expect("geolocalizacion" in calcularPatchAltaRetroactiva(base).altaArrendador!).toBe(false);
  });
  it("no toca los datos del contrato: el domicilio se edita ahi", () => {
    expect("contratoArrendamiento" in calcularPatchAltaRetroactiva(base)).toBe(false);
  });
});
