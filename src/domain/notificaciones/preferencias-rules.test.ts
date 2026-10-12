import { describe, expect, it } from "vitest";
import {
  combinarPorUid, filtrarDestinatarios, normalizarCorreosAdicionales, normalizarCorreosDesactivados, recibeCorreo,
  tiposCorreoAdicionales, tiposCorreoEditables,
} from "./preferencias-rules";

describe("tiposCorreoEditables", () => {
  it("el jefe de zona puede apagar el aviso de Pre-Cierre y los comentarios", () => {
    expect(tiposCorreoEditables("jefe_zona")).toEqual(["pre_cierre", "comentario_ticket"]);
  });

  it("ofrece a cada rol solo los correos que recibe hoy", () => {
    expect(tiposCorreoEditables("admin")).toEqual(["nuevo_ticket", "cambio_estatus", "cierre", "comentario_ticket"]);
    expect(tiposCorreoEditables("abogado")).toEqual(["asignacion", "reasignacion", "comentario_ticket", "cambios_solicitados"]);
    expect(tiposCorreoEditables("mesa_control")).toEqual(["asignacion", "reasignacion", "comentario_ticket", "cambios_solicitados"]);
  });

  it("el rol sitios solo recibe el aviso de Pre-Cierre (no participa en la conversacion)", () => {
    expect(tiposCorreoEditables("sitios")).toEqual(["pre_cierre"]);
  });

  it("los participantes de la conversacion pueden apagar sus avisos", () => {
    for (const rol of ["solicitante", "gerente_area", "gerente_juridico"] as const) {
      expect(tiposCorreoEditables(rol)).toContain("comentario_ticket");
      expect(tiposCorreoEditables(rol)).toContain("cambios_solicitados");
    }
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

describe("tiposCorreoAdicionales", () => {
  it("ofrece al abogado los avisos de gestion que su rol no recibe", () => {
    expect(tiposCorreoAdicionales("abogado")).toEqual(["nuevo_ticket", "cambio_estatus", "cierre"]);
  });

  it("no repite lo que el rol ya recibe", () => {
    expect(tiposCorreoAdicionales("admin")).toEqual([]);
    expect(tiposCorreoAdicionales("gerente_juridico")).toEqual([]);
  });

  it("no se ofrece a solicitantes ni gerentes de area", () => {
    expect(tiposCorreoAdicionales("solicitante")).toEqual([]);
    expect(tiposCorreoAdicionales("gerente_area")).toEqual([]);
  });
});

describe("normalizarCorreosAdicionales", () => {
  it("conserva solo tipos ofrecidos al rol, sin repetidos", () => {
    expect(normalizarCorreosAdicionales(["nuevo_ticket", "nuevo_ticket", "asignacion", "basura"], "abogado")).toEqual({
      ok: true,
      tipos: ["nuevo_ticket"],
    });
  });

  it("descarta lo que el rol ya recibe", () => {
    expect(normalizarCorreosAdicionales(["nuevo_ticket"], "admin")).toEqual({ ok: true, tipos: [] });
  });

  it("rechaza lo que no es una lista de textos", () => {
    expect(normalizarCorreosAdicionales("nuevo_ticket", "abogado").ok).toBe(false);
    expect(normalizarCorreosAdicionales([1], "abogado").ok).toBe(false);
  });
});

describe("combinarPorUid", () => {
  it("une listas de usuarios sin repetir por uid", () => {
    const a = [{ uid: "1", email: "a@x.com" }, { uid: "2", email: "b@x.com" }];
    const b = [{ uid: "2", email: "b@x.com" }, { uid: "3", email: "c@x.com" }];
    expect(combinarPorUid(a, b).map((u) => u.uid)).toEqual(["1", "2", "3"]);
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
