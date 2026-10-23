import { describe, it, expect } from "vitest";
import { agruparDocumentos, formaPagoLabel, formatMonto, NO_DISPONIBLE, sitioYCodigoResumen, textoDiscrepancia, textoODisponible } from "./resumen-presentacion";

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

describe("sitioYCodigoResumen", () => {
  const ficha = { clave: "QRO01", alias: "Queretaro Centro" };

  it("usa la ficha cuando el contrato no trae sitio ni codigo", () => {
    expect(sitioYCodigoResumen({ sitio: null, codigo: null }, ficha)).toEqual({ sitio: "Queretaro Centro", codigo: "QRO01" });
  });

  it("prefiere lo que consta en el contrato", () => {
    expect(sitioYCodigoResumen({ sitio: "Torre", codigo: "X1" }, ficha)).toEqual({ sitio: "Torre", codigo: "X1" });
  });

  it("devuelve null si tampoco hay dato en la ficha", () => {
    expect(sitioYCodigoResumen({ sitio: " ", codigo: null }, { clave: "", alias: "" })).toEqual({ sitio: null, codigo: null });
  });
});

describe("agruparDocumentos", () => {
  const doc = (etiqueta: string, grupo?: "formato" | "arrendamiento" | "adjunto") => ({ etiqueta, url: `https://x/${etiqueta}`, grupo });

  it("separa en las mismas secciones que la solicitud y omite las vacias", () => {
    const grupos = agruparDocumentos([doc("a.pdf", "adjunto"), doc("Formato", "formato"), doc("Predial", "arrendamiento")]);
    expect(grupos.map((g) => g.titulo)).toEqual([
      "Formato de solicitud de arrendamiento",
      "Documentos de arrendamiento",
      "Documentación adjunta",
    ]);
  });

  it("resumenes previos sin grupo van en una sola lista", () => {
    expect(agruparDocumentos([doc("a.pdf"), doc("b.pdf")])).toEqual([
      expect.objectContaining({ titulo: "Documentos del ticket" }),
    ]);
  });

  it("sin documentos no hay secciones", () => {
    expect(agruparDocumentos([])).toEqual([]);
  });
});
