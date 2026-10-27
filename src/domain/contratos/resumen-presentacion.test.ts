import { describe, it, expect } from "vitest";
import { agruparDocumentos, datosDelTicket, formaPagoLabel, formatMonto, NO_DISPONIBLE, sitioYCodigoResumen, textoDiscrepancia, textoODisponible } from "./resumen-presentacion";

describe("datosDelTicket", () => {
  const COMPLETO = {
    solicitante: "Ana", areaEmpresa: "Grupo EPL", motivo: "Alta de Arrendador", sitioClave: "QRO01", sitioAlias: "Centro",
    domicilio: "Calle 1", altaArrendador: "Juan Perez", metodoPago: "63 - Transferencia", condicionesPago: "63 - Transferencia",
    montoPagoAnual: 120000, formaPago: "mensual" as const,
  };
  const EXTRA = { servicio: "Alta de Arrendadores", fechaSolicitud: "27 de octubre de 2026", periodo: "01/01/2026 — 01/01/2027" };
  const etiquetas = (d: { label: string }[]) => d.map((x) => x.label);

  it("muestra todos los campos que tienen informacion, en orden", () => {
    expect(etiquetas(datosDelTicket(COMPLETO, EXTRA))).toEqual([
      "Solicitante", "Empresa / Área", "Servicio", "Fecha de solicitud", "Motivo", "Sitio", "Codigo", "Domicilio",
      "Alta de arrendador", "Periodo", "Metodo de pago", "Condiciones de pago", "Monto anual", "Forma de pago",
    ]);
  });

  it("no muestra los campos vacios, nulos o con solo espacios", () => {
    const vacios = {
      ...COMPLETO, domicilio: null, altaArrendador: "  ", metodoPago: undefined, condicionesPago: null,
      montoPagoAnual: null, formaPago: null, sitioClave: null, sitioAlias: null, motivo: null, areaEmpresa: undefined,
    };
    const e = etiquetas(datosDelTicket(vacios, { servicio: null, fechaSolicitud: null, periodo: null }));
    expect(e).toEqual(["Solicitante"]);
  });

  it("nunca pinta 'No disponible'", () => {
    const textos = datosDelTicket({ ...COMPLETO, domicilio: null, montoPagoAnual: null }, EXTRA).map((d) => d.valor);
    expect(textos).not.toContain(NO_DISPONIBLE);
  });

  it("un campo vacio aparece cuando despues se llena", () => {
    const antes = etiquetas(datosDelTicket({ ...COMPLETO, domicilio: null }, EXTRA));
    const despues = etiquetas(datosDelTicket({ ...COMPLETO, domicilio: "Calle 1" }, EXTRA));
    expect(antes).not.toContain("Domicilio");
    expect(despues).toContain("Domicilio");
  });

  it("el sitio muestra clave y alias, o solo la clave si no hay alias; el codigo es la clave", () => {
    const d = (r: object) => datosDelTicket({ ...COMPLETO, ...r }, EXTRA);
    expect(d({}).find((x) => x.label === "Sitio")?.valor).toBe("QRO01 — Centro");
    expect(d({ sitioAlias: null }).find((x) => x.label === "Sitio")?.valor).toBe("QRO01");
    expect(d({}).find((x) => x.label === "Codigo")?.valor).toBe("QRO01");
  });

  it("el monto en cero si se muestra (hay informacion)", () => {
    expect(etiquetas(datosDelTicket({ ...COMPLETO, montoPagoAnual: 0 }, EXTRA))).toContain("Monto anual");
  });
});

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
