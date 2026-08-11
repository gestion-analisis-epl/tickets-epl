import { describe, it, expect } from "vitest";
import { sanitizeSpaces, toTitleCase, toSentenceCase, formatMonedaMXN, formatMontoInput, parseMontoInput } from "./text-format";

describe("formatMonedaMXN", () => {
  it("formatea un numero como moneda MXN con separador de miles y 2 decimales", () => {
    expect(formatMonedaMXN(15000)).toBe("$15,000.00");
  });

  it("redondea a 2 decimales", () => {
    expect(formatMonedaMXN(1234.5)).toBe("$1,234.50");
  });
});

describe("formatMontoInput", () => {
  it("inserta comas de millar en la parte entera conforme se escribe", () => {
    expect(formatMontoInput("15000")).toBe("15,000");
  });

  it("conserva hasta 2 decimales", () => {
    expect(formatMontoInput("1234.5")).toBe("1,234.5");
    expect(formatMontoInput("1234.56")).toBe("1,234.56");
  });

  it("descarta decimales de mas alla del segundo", () => {
    expect(formatMontoInput("1234.567")).toBe("1,234.56");
  });

  it("quita cualquier caracter que no sea digito o punto", () => {
    expect(formatMontoInput("$1,234abc")).toBe("1,234");
  });

  it("quita ceros a la izquierda innecesarios", () => {
    expect(formatMontoInput("0025")).toBe("25");
  });

  it("permite escribir solo un punto decimal sin enteros todavia", () => {
    expect(formatMontoInput(".5")).toBe(".5");
  });

  it("ignora un segundo punto decimal escrito por error", () => {
    expect(formatMontoInput("12.34.56")).toBe("12.34");
  });
});

describe("parseMontoInput", () => {
  it("quita las comas de millar y regresa un numero", () => {
    expect(parseMontoInput("15,000.50")).toBe(15000.5);
  });

  it("regresa el numero tal cual si no tiene comas", () => {
    expect(parseMontoInput("1234.5")).toBe(1234.5);
  });
});

describe("sanitizeSpaces", () => {
  it("quita espacios al inicio y final", () => {
    expect(sanitizeSpaces("  hola mundo  ")).toBe("hola mundo");
  });

  it("colapsa espacios internos multiples a uno solo", () => {
    expect(sanitizeSpaces("hola     mundo")).toBe("hola mundo");
  });

  it("deja vacio un texto que solo tenia espacios", () => {
    expect(sanitizeSpaces("   ")).toBe("");
  });
});

describe("toTitleCase", () => {
  it("pone en mayuscula la primera letra de cada palabra", () => {
    expect(toTitleCase("avenida insurgentes sur")).toBe("Avenida Insurgentes Sur");
  });

  it("normaliza mayusculas irregulares a formato nombre propio", () => {
    expect(toTitleCase("JUAN pérez GARCÍA")).toBe("Juan Pérez García");
  });

  it("tambien sanitiza espacios antes de aplicar el formato", () => {
    expect(toTitleCase("  juan   perez  ")).toBe("Juan Perez");
  });

  it("regresa vacio si el texto de entrada esta vacio", () => {
    expect(toTitleCase("   ")).toBe("");
  });
});

describe("toSentenceCase", () => {
  it("pone en mayuscula solo la primera letra del texto", () => {
    expect(toSentenceCase("el arrendador solicito una prorroga")).toBe("El arrendador solicito una prorroga");
  });

  it("pone en mayuscula la primera letra despues de cada punto", () => {
    expect(toSentenceCase("primera nota. segunda nota. tercera nota")).toBe(
      "Primera nota. Segunda nota. Tercera nota"
    );
  });

  it("normaliza un texto escrito todo en mayusculas al formato de oracion", () => {
    expect(toSentenceCase("SIN NOVEDAD. TODO EN ORDEN")).toBe("Sin novedad. Todo en orden");
  });

  it("tambien sanitiza espacios antes de aplicar el formato", () => {
    expect(toSentenceCase("  hola   mundo  ")).toBe("Hola mundo");
  });

  it("capitaliza correctamente cuando la primera letra es acentuada", () => {
    expect(toSentenceCase("área en remodelacion. óptimo resultado")).toBe("Área en remodelacion. Óptimo resultado");
  });
});
