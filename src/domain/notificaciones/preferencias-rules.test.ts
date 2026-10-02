import { describe, expect, it } from "vitest";
import { filtrarDestinatarios, normalizarCorreosDesactivados, recibeCorreo, tiposCorreoEditables } from "./preferencias-rules";

describe("tiposCorreoEditables", () => {
  it("ofrece a cada rol solo los correos que recibe hoy", () => {
    expect(tiposCorreoEditables("admin")).toEqual(["nuevo_ticket", "cambio_estatus", "cierre"]);
    expect(tiposCorreoEditables("abogado")).toEqual(["asignacion", "reasignacion"]);
    expect(tiposCorreoEditables("mesa_control")).toEqual(["asignacion", "reasignacion"]);
  });

  it("no ofrece el cierre del solicitante (lleva el link de calificacion)", () => {
    expect(tiposCorreoEditables("solicitante")).not.toContain("cierre");
  });

  it("al gerente de area le suma el cierre de sus supervisados", () => {
    expect(tiposCorreoEditables("gerente_area")).toContain("cierre");
    expect(tiposCorreoEditables("gerente_area")).toContain("creacion_solicitante");
  });
});

describe("recibeCorreo", () => {
  it("recibe todo si no definio preferencias", () => {
    expect(recibeCorreo({}, "cierre")).toBe(true);
  });

  it("no recibe los tipos desactivados", () => {
    expect(recibeCorreo({ correosDesactivados: ["cierre"] }, "cierre")).toBe(false);
    expect(recibeCorreo({ correosDesactivados: ["cierre"] }, "nuevo_ticket")).toBe(true);
  });
});

describe("filtrarDestinatarios", () => {
  const u = (email: string, correosDesactivados?: never[] | string[]) => ({ email, activo: true, correosDesactivados } as never);

  it("separa los que reciben de los omitidos por preferencia", () => {
    const r = filtrarDestinatarios([u("a@x.com"), u("b@x.com", ["cierre"])], "cierre");
    expect(r).toEqual({ emails: ["a@x.com"], omitidos: 1 });
  });

  it("ignora inactivos y sin correo, y no repite", () => {
    const usuarios = [{ email: "a@x.com", activo: true }, { email: "a@x.com", activo: true }, { email: "", activo: true }, { email: "c@x.com", activo: false }];
    expect(filtrarDestinatarios(usuarios, "cierre")).toEqual({ emails: ["a@x.com"], omitidos: 0 });
  });
});

describe("normalizarCorreosDesactivados", () => {
  it("conserva solo tipos editables del rol, sin repetidos", () => {
    expect(normalizarCorreosDesactivados(["cierre", "cierre", "asignacion", "basura"], "admin")).toEqual({ ok: true, tipos: ["cierre"] });
  });

  it("rechaza lo que no es una lista de textos", () => {
    expect(normalizarCorreosDesactivados("cierre", "admin").ok).toBe(false);
    expect(normalizarCorreosDesactivados([1], "admin").ok).toBe(false);
  });
});
