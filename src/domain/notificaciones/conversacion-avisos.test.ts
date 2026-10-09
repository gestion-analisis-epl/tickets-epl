import { describe, expect, it } from "vitest";
import {
  correosPorEnlace,
  decidirAvisoComentario,
  destinatariosAviso,
  esTipoSoloServidor,
  mensajeAviso,
  type DestinatarioAviso,
  type UsuarioAviso,
} from "./conversacion-avisos";

describe("esTipoSoloServidor", () => {
  it("los avisos de la conversacion no se pueden pedir desde el cliente", () => {
    expect(esTipoSoloServidor("comentario_ticket")).toBe(true);
    expect(esTipoSoloServidor("cambios_solicitados")).toBe(true);
    expect(esTipoSoloServidor("cierre")).toBe(false);
    expect(esTipoSoloServidor(undefined)).toBe(false);
  });
});

const usuarios: UsuarioAviso[] = [
  { uid: "sol", role: "solicitante", email: "sol@x.com" }, // sin "activo": el dueno cuenta como activo
  { uid: "abo", role: "abogado", activo: true, email: "abo@x.com", abogadoId: "AB1" },
  { uid: "abo2", role: "abogado", activo: true, email: "abo2@x.com", abogadoId: "AB2" },
  { uid: "gj", role: "gerente_juridico", activo: true, email: "gj@x.com" },
  { uid: "adm", role: "admin", activo: true, email: "adm@x.com" },
  { uid: "adm-off", role: "admin", activo: false, email: "off@x.com" },
  { uid: "jz", role: "jefe_zona", activo: true, email: "jz@x.com" },
  { uid: "mc", role: "mesa_control", activo: true, email: "mc@x.com" },
  { uid: "sit", role: "sitios", activo: true, email: "sit@x.com" }, // Rol Sitios: nunca recibe avisos de la conversacion
];
const ticket = { solicitanteId: "sol", abogadoAsignadoId: "AB1", estatus: "Pre-Cierre" as const };
const uids = (d: DestinatarioAviso[]) => d.map((x) => x.usuario.uid);

describe("destinatariosAviso", () => {
  it("un comentario avisa a dueno, abogado asignado, GJ/admin activos y jefes de zona, menos al autor", () => {
    expect(uids(destinatariosAviso("comentario_ticket", ticket, usuarios, "gj"))).toEqual(["sol", "abo", "adm", "jz"]);
  });

  it("los jefes de zona reciben el enlace a /pre-cierre; los demas a /tickets", () => {
    const d = destinatariosAviso("comentario_ticket", ticket, usuarios, "gj");
    expect(d.find((x) => x.usuario.uid === "jz")?.enlace).toBe("pre-cierre");
    expect(d.filter((x) => x.usuario.uid !== "jz").every((x) => x.enlace === "tickets")).toBe(true);
  });

  it("si el ticket regreso a una etapa anterior, los jefes de zona se siguen avisando (conservan el acceso)", () => {
    const d = destinatariosAviso("comentario_ticket", { ...ticket, estatus: "Proceso en tramite" }, usuarios, "sol");
    expect(uids(d)).toEqual(["abo", "gj", "adm", "jz"]);
    expect(d.find((x) => x.usuario.uid === "jz")?.enlace).toBe("pre-cierre");
  });

  it("cambios solicitados solo avisa al abogado asignado y al solicitante", () => {
    expect(uids(destinatariosAviso("cambios_solicitados", ticket, usuarios, "jz"))).toEqual(["sol", "abo"]);
  });

  it("sin abogado asignado no se avisa a ningun abogado y no se repiten usuarios", () => {
    const d = destinatariosAviso("comentario_ticket", { ...ticket, abogadoAsignadoId: null }, [...usuarios, usuarios[3]], "jz");
    expect(uids(d)).toEqual(["sol", "gj", "adm"]);
  });
});

describe("correosPorEnlace", () => {
  it("separa por enlace y respeta los correos apagados", () => {
    const conPreferencia = usuarios.map((u) => (u.uid === "adm" ? { ...u, correosDesactivados: ["comentario_ticket" as const] } : u));
    const d = destinatariosAviso("comentario_ticket", ticket, conPreferencia, "gj");
    expect(correosPorEnlace(d, "comentario_ticket")).toEqual({ tickets: ["sol@x.com", "abo@x.com"], "pre-cierre": ["jz@x.com"] });
  });
});

describe("mensajeAviso", () => {
  it("lleva folio y autor, nunca el texto", () => {
    expect(mensajeAviso("comentario_ticket", "JUR-0042", "Ana")).toBe("Ana comento en el ticket JUR-0042.");
    expect(mensajeAviso("cambios_solicitados", "JUR-0042", "Jefe Uno")).toBe(
      "Jefe Uno pidio cambios en el ticket JUR-0042. Regreso a Proceso en tramite."
    );
  });
});

describe("decidirAvisoComentario", () => {
  const base = { autorUid: "u1", tipo: "comentario" as const, eliminado: false };

  it("solo el autor de un comentario normal dispara el aviso, una sola vez", () => {
    expect(decidirAvisoComentario(base, "u1")).toBe("avisar");
    expect(decidirAvisoComentario({ ...base, avisoEnviado: true }, "u1")).toBe("ya_avisado");
    expect(decidirAvisoComentario({ ...base, eliminado: true }, "u1")).toBe("ya_avisado");
  });

  it("otro usuario, un comentario inexistente o uno de cambios solicitados: prohibido", () => {
    expect(decidirAvisoComentario(base, "u2")).toBe("prohibido");
    expect(decidirAvisoComentario(null, "u1")).toBe("prohibido");
    expect(decidirAvisoComentario({ ...base, tipo: "cambios_solicitados" }, "u1")).toBe("prohibido");
  });
});
