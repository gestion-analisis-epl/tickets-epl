import { describe, expect, it } from "vitest";
import {
  debeAbrirConversacion,
  esParticipante,
  hiloEscribible,
  hiloVisible,
  MAX_TEXTO_COMENTARIO,
  puedeEditarComentario,
  validarTextoComentario,
} from "./conversacion-rules";

describe("validarTextoComentario", () => {
  it("recorta espacios y acepta texto normal", () => {
    expect(validarTextoComentario("  Falta el anexo  ")).toEqual({ ok: true, texto: "Falta el anexo" });
  });

  it("rechaza texto vacio o solo espacios", () => {
    expect(validarTextoComentario("   ").ok).toBe(false);
    expect(validarTextoComentario("").ok).toBe(false);
  });

  it("acepta exactamente 4000 caracteres y rechaza 4001", () => {
    expect(MAX_TEXTO_COMENTARIO).toBe(4000);
    expect(validarTextoComentario("a".repeat(4000)).ok).toBe(true);
    expect(validarTextoComentario("a".repeat(4001))).toEqual({ ok: false, error: "El comentario no puede pasar de 4000 caracteres." });
  });
});

describe("hilo de la conversacion", () => {
  it("se habilita en Pre-Cierre aunque no tenga conversacionAbiertaEn (tickets previos al despliegue)", () => {
    expect(hiloVisible({ estatus: "Pre-Cierre" })).toBe(true);
    expect(hiloEscribible({ estatus: "Pre-Cierre" })).toBe(true);
  });

  it("si regresa a una etapa anterior se sigue escribiendo", () => {
    const t = { estatus: "Proceso en tramite" as const, conversacionAbiertaEn: "2026-10-01T00:00:00.000Z" };
    expect(hiloVisible(t)).toBe(true);
    expect(hiloEscribible(t)).toBe(true);
  });

  it("en Cierre es de solo lectura", () => {
    const t = { estatus: "Cierre" as const, conversacionAbiertaEn: "2026-10-01T00:00:00.000Z" };
    expect(hiloVisible(t)).toBe(true);
    expect(hiloEscribible(t)).toBe(false);
  });

  it("un ticket que nunca llego a Pre-Cierre no tiene hilo", () => {
    expect(hiloVisible({ estatus: "Proceso en tramite" })).toBe(false);
    expect(hiloVisible({ estatus: "Cierre" })).toBe(false);
  });
});

describe("debeAbrirConversacion", () => {
  it("al entrar por primera vez a Pre-Cierre", () => {
    expect(debeAbrirConversacion({ estatus: "Proceso en tramite" }, "Pre-Cierre")).toBe(true);
  });

  it("no si ya estaba abierta", () => {
    expect(debeAbrirConversacion({ estatus: "Proceso en tramite", conversacionAbiertaEn: "x" }, "Pre-Cierre")).toBe(false);
  });

  it("un ticket que ya estaba en Pre-Cierre al desplegar la abre al salir", () => {
    expect(debeAbrirConversacion({ estatus: "Pre-Cierre" }, "Cierre")).toBe(true);
  });

  it("no en etapas previas", () => {
    expect(debeAbrirConversacion({ estatus: "Recepcion de solicitud" }, "Proceso en tramite")).toBe(false);
  });
});

describe("esParticipante", () => {
  const ticket = { solicitanteId: "sol", abogadoAsignadoId: "AB1" };

  it("dueno, abogado asignado, gerente juridico, admin y jefe de zona", () => {
    expect(esParticipante({ uid: "sol", role: "solicitante", abogadoId: null }, ticket)).toBe(true);
    expect(esParticipante({ uid: "a", role: "abogado", abogadoId: "AB1" }, ticket)).toBe(true);
    expect(esParticipante({ uid: "g", role: "gerente_juridico", abogadoId: null }, ticket)).toBe(true);
    expect(esParticipante({ uid: "ad", role: "admin", abogadoId: null }, ticket)).toBe(true);
    expect(esParticipante({ uid: "j", role: "jefe_zona", abogadoId: null }, ticket)).toBe(true);
  });

  it("no participan mesa de control, otros abogados ni otros solicitantes", () => {
    expect(esParticipante({ uid: "m", role: "mesa_control", abogadoId: null }, ticket)).toBe(false);
    expect(esParticipante({ uid: "a2", role: "abogado", abogadoId: "AB2" }, ticket)).toBe(false);
    expect(esParticipante({ uid: "otro", role: "solicitante", abogadoId: null }, ticket)).toBe(false);
    expect(esParticipante({ uid: null, role: "admin", abogadoId: null }, ticket)).toBe(false);
  });

  it("el rol sitios (solo resumen) no participa", () => {
    expect(esParticipante({ uid: "s", role: "sitios", abogadoId: null }, ticket)).toBe(false);
  });
});

describe("puedeEditarComentario", () => {
  const propio = { autorUid: "u1", eliminado: false, tipo: "comentario" as const };

  it("solo el autor, sobre un comentario vivo de tipo comentario", () => {
    expect(puedeEditarComentario("u1", propio)).toBe(true);
    expect(puedeEditarComentario("u2", propio)).toBe(false);
    expect(puedeEditarComentario(null, propio)).toBe(false);
    expect(puedeEditarComentario("u1", { ...propio, eliminado: true })).toBe(false);
    expect(puedeEditarComentario("u1", { ...propio, tipo: "cambios_solicitados" })).toBe(false);
  });
});
