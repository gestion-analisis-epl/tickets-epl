import { describe, expect, it } from "vitest";
import { gerentesQueSupervisan, normalizarSupervisaUids } from "./supervision-rules";

const opts = { propioUid: "g1", uidsExistentes: new Set(["g1", "a", "b", "c"]) };

describe("normalizarSupervisaUids", () => {
  it("acepta una lista de usuarios existentes", () => {
    expect(normalizarSupervisaUids(["a", "b"], opts)).toEqual({ ok: true, uids: ["a", "b"] });
  });

  it("acepta una lista vacia (quitar todos los supervisados)", () => {
    expect(normalizarSupervisaUids([], opts)).toEqual({ ok: true, uids: [] });
  });

  it("quita repetidos y vacios, y recorta espacios", () => {
    expect(normalizarSupervisaUids([" a ", "a", "", "b"], opts)).toEqual({ ok: true, uids: ["a", "b"] });
  });

  it("rechaza lo que no sea una lista", () => {
    for (const malo of [null, undefined, "a", 5, { a: 1 }]) {
      expect(normalizarSupervisaUids(malo, opts).ok).toBe(false);
    }
  });

  it("rechaza elementos que no sean texto", () => {
    expect(normalizarSupervisaUids(["a", 5], opts).ok).toBe(false);
  });

  it("no deja que alguien se supervise a si mismo", () => {
    const r = normalizarSupervisaUids(["a", "g1"], opts);
    expect(r.ok).toBe(false);
  });

  it("rechaza usuarios que no existen", () => {
    const r = normalizarSupervisaUids(["a", "fantasma"], opts);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("fantasma") });
  });
});

describe("gerentesQueSupervisan", () => {
  const g = (o: object) => ({ role: "gerente_area", activo: true, email: "g@x.com", supervisaUids: ["s1"], ...o });

  it("devuelve los gerentes de area que supervisan al solicitante", () => {
    const a = g({ email: "a@x.com" });
    expect(gerentesQueSupervisan([a, g({ email: "b@x.com", supervisaUids: ["s2"] })], "s1")).toEqual([a]);
  });

  it("ignora inactivos, sin correo, sin lista y otros roles", () => {
    const usuarios = [g({ activo: false }), g({ email: "" }), g({ supervisaUids: undefined }), g({ role: "admin" })];
    expect(gerentesQueSupervisan(usuarios, "s1")).toEqual([]);
  });
});
