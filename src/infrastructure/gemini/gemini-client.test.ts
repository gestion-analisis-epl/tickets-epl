import { describe, expect, it } from "vitest";
import { ESQUEMA_EXTRACCION } from "./gemini-client";

// Sin `required` el modelo puede omitir campos en vez de devolver null (visto con un PDF real:
// solo devolvia 2 de 10 claves y la tarjeta mostraba "No consta" en el resto).
describe("ESQUEMA_EXTRACCION", () => {
  const claves = Object.keys(ESQUEMA_EXTRACCION.properties);

  it("declara los 10 campos del resumen", () => {
    expect(claves.sort()).toEqual(
      [
        "altaArrendador", "codigo", "condicionesPago", "domicilio", "formaPago",
        "montoPagoAnual", "periodoFin", "periodoInicio", "sitio", "solicitante",
      ].sort()
    );
  });

  it("exige todas las claves, para que el modelo devuelva null y no las omita", () => {
    expect([...ESQUEMA_EXTRACCION.required].sort()).toEqual([...claves].sort());
  });

  it("fija el orden de las propiedades", () => {
    expect(ESQUEMA_EXTRACCION.propertyOrdering).toEqual(claves);
  });
});
