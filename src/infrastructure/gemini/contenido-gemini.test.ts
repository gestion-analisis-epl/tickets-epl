import { describe, expect, it } from "vitest";
import { aContents, INSTRUCCION_PDF } from "./contenido-gemini";

describe("aContents", () => {
  it("envia el texto de un docx precedido por su nombre", () => {
    expect(aContents([{ etiqueta: "Contrato", contenido: { tipo: "texto", texto: "<contrato>\nhola\n</contrato>" } }])).toEqual([
      { role: "user", parts: [{ text: "Documento: Contrato" }, { text: "<contrato>\nhola\n</contrato>" }, { text: INSTRUCCION_PDF }] },
    ]);
  });

  it("envia un PDF como inlineData precedido por su nombre", () => {
    expect(aContents([{ etiqueta: "Predial", contenido: { tipo: "pdf", base64: "QUJD" } }])).toEqual([
      { role: "user", parts: [{ text: "Documento: Predial" }, { inlineData: { mimeType: "application/pdf", data: "QUJD" } }, { text: INSTRUCCION_PDF }] },
    ]);
  });

  it("junta varios documentos en un solo mensaje, en orden", () => {
    const [mensaje] = aContents([
      { etiqueta: "A", contenido: { tipo: "pdf", base64: "x" } },
      { etiqueta: "B", contenido: { tipo: "texto", texto: "t" } },
    ]);
    expect(mensaje.parts).toEqual([
      { text: "Documento: A" }, { inlineData: { mimeType: "application/pdf", data: "x" } },
      { text: "Documento: B" }, { text: "t" }, { text: INSTRUCCION_PDF },
    ]);
  });
});
