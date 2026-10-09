import { describe, it, expect } from "vitest";
import { dominioPermitido } from "./dominios-permitidos";

describe("dominioPermitido", () => {
  it("acepta los dominios del grupo sin importar mayusculas", () => {
    expect(dominioPermitido("alguien@grupoepl.com.mx")).toBe(true);
    expect(dominioPermitido("Alguien@GrupoEPL.com.mx")).toBe(true);
  });

  it("acepta solo el Gmail autorizado, no el dominio gmail.com", () => {
    expect(dominioPermitido("xxales11xx@gmail.com")).toBe(true);
    expect(dominioPermitido("XXales11xx@gmail.com")).toBe(true);
    expect(dominioPermitido("otro@gmail.com")).toBe(false);
  });

  it("rechaza dominios ajenos y correos mal formados", () => {
    expect(dominioPermitido("a@evil.com")).toBe(false);
    expect(dominioPermitido("sin-arroba")).toBe(false);
  });
});
