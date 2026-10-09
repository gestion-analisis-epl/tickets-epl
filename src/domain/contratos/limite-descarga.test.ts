import { describe, expect, it } from "vitest";
import { limiteBytesContrato } from "./limite-descarga";

describe("limiteBytesContrato", () => {
  it("permite 20 MB para docx", () => {
    expect(limiteBytesContrato("docx")).toBe(20 * 1024 * 1024);
  });

  it("limita los PDF a 14 MB para que el base64 quepa en la peticion de Gemini", () => {
    expect(limiteBytesContrato("pdf")).toBe(14 * 1024 * 1024);
    expect(Math.ceil((limiteBytesContrato("pdf") * 4) / 3)).toBeLessThan(20 * 1024 * 1024);
  });
});
