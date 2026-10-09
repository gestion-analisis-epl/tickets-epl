import { describe, expect, it } from "vitest";
import { aContents, INSTRUCCION_PDF } from "./contenido-gemini";

describe("aContents", () => {
  it("envia el texto tal cual", () => {
    expect(aContents({ tipo: "texto", texto: "<contrato>\nhola\n</contrato>" })).toBe("<contrato>\nhola\n</contrato>");
  });

  it("envia el PDF como inlineData seguido de la instruccion de texto", () => {
    expect(aContents({ tipo: "pdf", base64: "QUJD" })).toEqual([
      { role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: "QUJD" } }, { text: INSTRUCCION_PDF }] },
    ]);
  });
});
