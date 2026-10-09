import { describe, it, expect } from "vitest";
import { tienePermiso, normalizarAjustes, quedaGestorDeUsuarios } from "./permisos";

describe("tienePermiso", () => {
  it("hereda del rol cuando no hay ajuste", () => {
    expect(tienePermiso({ role: "admin" }, "gestionar_usuarios")).toBe(true);
    expect(tienePermiso({ role: "abogado" }, "asignar_tickets")).toBe(false);
  });

  it("un ajuste true concede y uno false quita", () => {
    expect(tienePermiso({ role: "abogado", permisos: { asignar_tickets: true } }, "asignar_tickets")).toBe(true);
    expect(tienePermiso({ role: "gerente_juridico", permisos: { asignar_tickets: false } }, "asignar_tickets")).toBe(false);
  });

  it("eliminar tickets es solo del rol admin aunque se conceda", () => {
    expect(tienePermiso({ role: "abogado", permisos: { eliminar_tickets: true } }, "eliminar_tickets")).toBe(false);
    expect(tienePermiso({ role: "gerente_juridico" }, "eliminar_tickets")).toBe(false);
    expect(tienePermiso({ role: "admin" }, "eliminar_tickets")).toBe(true);
    expect(tienePermiso({ role: "admin", permisos: { eliminar_tickets: false } }, "eliminar_tickets")).toBe(false);
  });
});

describe("normalizarAjustes", () => {
  it("conserva solo las excepciones al rol", () => {
    const r = normalizarAjustes({ asignar_tickets: true, ver_historial: false }, "abogado");
    expect(r).toEqual({ ok: true, ajustes: { asignar_tickets: true } });
  });

  it("rechaza permisos desconocidos, valores no booleanos y no objetos", () => {
    expect(normalizarAjustes({ volar: true }, "abogado").ok).toBe(false);
    expect(normalizarAjustes({ asignar_tickets: "si" }, "abogado").ok).toBe(false);
    expect(normalizarAjustes([], "abogado").ok).toBe(false);
    expect(normalizarAjustes(null, "abogado").ok).toBe(false);
  });

  it("rechaza conceder eliminar tickets a otro rol", () => {
    expect(normalizarAjustes({ eliminar_tickets: true }, "gerente_juridico").ok).toBe(false);
    expect(normalizarAjustes({ eliminar_tickets: true }, "admin")).toEqual({ ok: true, ajustes: {} });
  });
});

describe("quedaGestorDeUsuarios", () => {
  const admin = { uid: "a", role: "admin" as const, activo: true };
  const otro = { uid: "b", role: "abogado" as const, activo: true };

  it("falla si se quita al unico gestor", () => {
    expect(quedaGestorDeUsuarios([admin, otro], "a", null)).toBe(false);
    expect(quedaGestorDeUsuarios([admin, otro], "a", { ...admin, activo: false })).toBe(false);
    expect(quedaGestorDeUsuarios([admin, otro], "a", { ...admin, permisos: { gestionar_usuarios: false } })).toBe(false);
  });

  it("pasa si queda otro gestor activo", () => {
    const gj = { uid: "c", role: "gerente_juridico" as const, activo: true };
    expect(quedaGestorDeUsuarios([admin, gj], "a", null)).toBe(true);
  });
});
