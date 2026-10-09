import { describe, expect, it } from "vitest";
import { calcularCambios, textoDeValor, textoDocumentos, type CampoVigilado } from "./historial-rules";
import { buildTicket } from "@/test/ticket-fixture";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/tickets-epl-legal/o/tickets%2Ft1%2F${encodeURIComponent(nombre)}?alt=media&token=x`;

describe("textoDeValor", () => {
  it("convierte cada tipo de valor a texto legible", () => {
    expect(textoDeValor(null)).toBeNull();
    expect(textoDeValor(undefined)).toBeNull();
    expect(textoDeValor("")).toBeNull();
    expect(textoDeValor("hola")).toBe("hola");
    expect(textoDeValor(5)).toBe("5");
    expect(textoDeValor(true)).toBe("sí");
    expect(textoDeValor(false)).toBe("no");
    expect(textoDeValor(["a", "b"])).toBe("a, b");
    expect(textoDeValor([])).toBeNull();
    expect(textoDeValor({ clave: "K1", alias: "Sitio Uno" })).toBe("K1 — Sitio Uno");
  });
});

describe("textoDocumentos", () => {
  it("lista los documentos por nombre de archivo, no por URL", () => {
    expect(textoDocumentos([url("1700_contrato.docx"), url("1800_predial.pdf")])).toBe("contrato.docx, predial.pdf");
  });

  it("sin documentos devuelve null", () => {
    expect(textoDocumentos([])).toBeNull();
    expect(textoDocumentos(undefined)).toBeNull();
  });

  it("una URL invalida no se copia al historial", () => {
    expect(textoDocumentos(["no-es-url"])).toBe("archivo sin nombre");
  });
});

describe("calcularCambios", () => {
  const campos: CampoVigilado[] = [
    { campo: "descripcion", etiqueta: "Descripcion" },
    { campo: "slaInterno", etiqueta: "SLA interno" },
    { campo: "documentacion", etiqueta: "Documentacion", formato: textoDocumentos },
  ];

  it("solo registra los campos vigilados que cambian", () => {
    const antes = buildTicket({ descripcion: "vieja", slaInterno: 5 });
    expect(calcularCambios(antes, { descripcion: "nueva", slaInterno: 5, areaEmpresa: "Otra" }, campos)).toEqual([
      { campo: "descripcion", etiqueta: "Descripcion", antes: "vieja", despues: "nueva" },
    ]);
  });

  it("ignora los campos vigilados que no vienen en el cambio", () => {
    expect(calcularCambios(buildTicket(), {}, campos)).toEqual([]);
  });

  it("usa el formato propio del campo", () => {
    const antes = buildTicket({ documentacion: [url("1_a.pdf")] });
    expect(calcularCambios(antes, { documentacion: [url("1_a.pdf"), url("2_b.pdf")] }, campos)).toEqual([
      { campo: "documentacion", etiqueta: "Documentacion", antes: "a.pdf", despues: "a.pdf, b.pdf" },
    ]);
  });

  it("pasar de texto vacio a null no cuenta como cambio", () => {
    expect(calcularCambios(buildTicket({ notasCierre: "" }), { notasCierre: null }, [{ campo: "notasCierre", etiqueta: "Notas" }])).toEqual([]);
  });
});
