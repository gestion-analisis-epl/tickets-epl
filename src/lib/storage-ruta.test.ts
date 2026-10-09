import { describe, it, expect } from "vitest";
import { esUrlStorageSegura, rutaDeUrlStorage, sinUndefined } from "./storage-ruta";

describe("rutaDeUrlStorage", () => {
  it("decodifica la ruta del objeto", () => {
    const url = "https://firebasestorage.googleapis.com/v0/b/b.appspot.com/o/tickets%2Fabc%2Fx%20y.docx?alt=media&token=t";
    expect(rutaDeUrlStorage(url)).toBe("tickets/abc/x y.docx");
  });
  it("devuelve null si la URL no es de Storage o es invalida", () => {
    expect(rutaDeUrlStorage("https://ejemplo.com/archivo.docx")).toBeNull();
    expect(rutaDeUrlStorage("no es url")).toBeNull();
  });
});

describe("sinUndefined", () => {
  it("elimina propiedades undefined anidadas y conserva null", () => {
    expect(sinUndefined({ a: 1, b: undefined, c: { d: undefined, e: null }, f: [{ g: undefined, h: 2 }] }))
      .toEqual({ a: 1, c: { e: null }, f: [{ h: 2 }] });
  });
});

describe("esUrlStorageSegura", () => {
  it("acepta solo https de firebasestorage.googleapis.com", () => {
    expect(esUrlStorageSegura("https://firebasestorage.googleapis.com/v0/b/b/o/x.docx?alt=media")).toBe(true);
    expect(esUrlStorageSegura("http://firebasestorage.googleapis.com/v0/b/b/o/x.docx")).toBe(false);
    expect(esUrlStorageSegura("javascript:alert(1)")).toBe(false);
    expect(esUrlStorageSegura("https://firebasestorage.googleapis.com.evil.test/x")).toBe(false);
    expect(esUrlStorageSegura("no es url")).toBe(false);
  });
});
