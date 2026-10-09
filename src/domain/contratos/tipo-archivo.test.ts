import { describe, expect, it } from "vitest";
import { esArchivoContrato, tipoContrato } from "./tipo-archivo";

describe("tipoContrato", () => {
  it("detecta docx y pdf sin importar mayusculas", () => {
    expect(tipoContrato("a.docx")).toBe("docx");
    expect(tipoContrato("A.DOCX")).toBe("docx");
    expect(tipoContrato("a.pdf")).toBe("pdf");
    expect(tipoContrato("A.Pdf")).toBe("pdf");
  });
  it("rechaza otras extensiones", () => {
    for (const n of ["a.pdf.exe", "a.doc", "a.txt", "pdf", "a.docx.zip", ""]) expect(tipoContrato(n)).toBeNull();
  });
  it("esArchivoContrato refleja tipoContrato", () => {
    expect(esArchivoContrato("a.pdf")).toBe(true);
    expect(esArchivoContrato("a.png")).toBe(false);
  });
});
