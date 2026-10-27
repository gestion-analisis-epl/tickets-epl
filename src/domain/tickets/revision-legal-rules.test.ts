import { describe, it, expect } from "vitest";
import {
  repartoEquitativo, normalizarRevisionLegal, faltantesRevisionLegal, revisionLegalPendiente, puedeEditarRevisionLegal,
} from "./revision-legal-rules";
import type { RevisionLegal } from "@/types/ticket";

const COMPLETA: RevisionLegal = {
  tipoPropietario: "fisica", nombrePropietario: "Juan Perez",
  acreditaPropiedad: true, documentoPropiedad: "u1",
  hayLimitacion: false, escenarioBeneficiario: "propietario", hayCondicionPago: false,
};

describe("repartoEquitativo", () => {
  it("suma siempre 10000 y el ultimo absorbe la diferencia", () => {
    expect(repartoEquitativo(2)).toEqual([5000, 5000]);
    expect(repartoEquitativo(3)).toEqual([3333, 3333, 3334]);
  });
});

describe("normalizarRevisionLegal", () => {
  it("borra los datos de persona moral al cambiar a fisica", () => {
    const r = normalizarRevisionLegal({ ...COMPLETA, representanteLegal: "X", documentoPersonalidad: "d" });
    expect(r.representanteLegal).toBeUndefined();
    expect(r.documentoPersonalidad).toBeUndefined();
  });
  it("conserva el documento que corresponde a acreditaPropiedad y borra el otro", () => {
    const r = normalizarRevisionLegal({ ...COMPLETA, cartaAutorizacion: "c" });
    expect(r.documentoPropiedad).toBe("u1");
    expect(r.cartaAutorizacion).toBeUndefined();
  });
  it("borra el tipo de limitacion si no hay limitacion", () => {
    expect(normalizarRevisionLegal({ ...COMPLETA, tipoLimitacion: "hipoteca" }).tipoLimitacion).toBeUndefined();
  });
  it("borra los datos de beneficiarios que no son del escenario elegido", () => {
    const r = normalizarRevisionLegal({ ...COMPLETA, beneficiarioNombre: "Z", beneficiarios: [{ nombre: "A", porcentaje: 10000 }] });
    expect(r.beneficiarioNombre).toBeUndefined();
    expect(r.beneficiarios).toBeUndefined();
  });
  it("calcula los porcentajes: equitativo y representante comun", () => {
    const base = { ...COMPLETA, escenarioBeneficiario: "varios" as const };
    const eq = normalizarRevisionLegal({ ...base, modalidadVarios: "equitativo", beneficiarios: [{ nombre: "A", porcentaje: 0 }, { nombre: "B", porcentaje: 0 }, { nombre: "C", porcentaje: 0 }] });
    expect(eq.beneficiarios!.map((b) => b.porcentaje)).toEqual([3333, 3333, 3334]);
    const rep = normalizarRevisionLegal({ ...base, modalidadVarios: "representante", representanteComun: 1, beneficiarios: [{ nombre: "A", porcentaje: 0 }, { nombre: "B", porcentaje: 0 }] });
    expect(rep.beneficiarios!.map((b) => b.porcentaje)).toEqual([0, 10000]);
  });
  it("sin modalidad o sin representante valido reparte en partes iguales (suma 10000)", () => {
    const base = { ...COMPLETA, escenarioBeneficiario: "varios" as const };
    const lista = [{ nombre: "A", porcentaje: 0 }, { nombre: "B", porcentaje: 0 }, { nombre: "C", porcentaje: 0 }];
    for (const r of [{ ...base, beneficiarios: lista }, { ...base, modalidadVarios: "representante" as const, beneficiarios: lista }]) {
      const pct = normalizarRevisionLegal(r).beneficiarios!.map((b) => b.porcentaje);
      expect(pct.reduce((x, y) => x + y, 0)).toBe(10000);
    }
  });
  it("no deja llaves undefined", () => {
    expect(Object.values(normalizarRevisionLegal(COMPLETA)).includes(undefined)).toBe(false);
  });
});

describe("faltantesRevisionLegal", () => {
  it("una revision completa no tiene faltantes", () => {
    expect(faltantesRevisionLegal(COMPLETA)).toEqual([]);
  });
  it("una revision vacia lista lo que falta", () => {
    expect(faltantesRevisionLegal({}).length).toBeGreaterThan(0);
  });
  it("persona moral exige razon social, representante y documento de personalidad", () => {
    const f = faltantesRevisionLegal({ ...COMPLETA, tipoPropietario: "moral" });
    expect(f).toEqual(expect.arrayContaining([expect.stringMatching(/representante/i), expect.stringMatching(/personalidad/i)]));
  });
  it("sin acreditar propiedad exige la carta de autorizacion", () => {
    expect(faltantesRevisionLegal({ ...COMPLETA, acreditaPropiedad: false, documentoPropiedad: undefined }).join(" ")).toMatch(/carta de autorizaci/i);
  });
  it("limitacion y condicion de pago exigen su descripcion", () => {
    const f = faltantesRevisionLegal({ ...COMPLETA, hayLimitacion: true, hayCondicionPago: true });
    expect(f.join(" ")).toMatch(/limitaci/i);
    expect(f.join(" ")).toMatch(/condici/i);
  });
  it("tercero exige nombre, acreditacion y la casilla de clausula", () => {
    const f = faltantesRevisionLegal({ ...COMPLETA, escenarioBeneficiario: "tercero" });
    expect(f.length).toBeGreaterThanOrEqual(3);
  });
  it("varios exige minimo 2 beneficiarios con nombre", () => {
    const f = faltantesRevisionLegal({ ...COMPLETA, escenarioBeneficiario: "varios", modalidadVarios: "equitativo", beneficiarios: [{ nombre: "A", porcentaje: 0 }] });
    expect(f.join(" ")).toMatch(/al menos 2/i);
  });
  it("representante comun exige elegirlo, su acreditacion y su carta", () => {
    const f = faltantesRevisionLegal({
      ...COMPLETA, escenarioBeneficiario: "varios", modalidadVarios: "representante",
      beneficiarios: [{ nombre: "A", porcentaje: 0 }, { nombre: "B", porcentaje: 0 }],
    });
    expect(f.length).toBeGreaterThanOrEqual(3);
  });
});

describe("revisionLegalPendiente", () => {
  it("un ticket sin altaArrendador (anterior al cambio) nunca queda pendiente", () => {
    expect(revisionLegalPendiente({ servicioId: "JUR-C071" })).toEqual([]);
  });
  it("si el servicio ya no es C071 no queda pendiente", () => {
    expect(revisionLegalPendiente({ altaArrendador: {} as never, servicioId: "JUR-C001" })).toEqual([]);
  });
  it("un ticket con altaArrendador y sin revision queda pendiente", () => {
    expect(revisionLegalPendiente({ altaArrendador: {} as never, servicioId: "JUR-C071" }).length).toBeGreaterThan(0);
  });
});

describe("puedeEditarRevisionLegal", () => {
  const ticket = { abogadoAsignadoId: "a1", estatus: "Proceso en tramite" as const, altaArrendador: {} as never };
  it("admin y abogado asignado si; Mesa de Control y otro abogado no", () => {
    expect(puedeEditarRevisionLegal({ role: "admin", abogadoId: null }, ticket)).toBe(true);
    expect(puedeEditarRevisionLegal({ role: "abogado", abogadoId: "a1" }, ticket)).toBe(true);
    expect(puedeEditarRevisionLegal({ role: "abogado", abogadoId: "a2" }, ticket)).toBe(false);
    expect(puedeEditarRevisionLegal({ role: "mesa_control", abogadoId: null }, ticket)).toBe(false);
  });
  it("no en Pre-Cierre ni sin altaArrendador", () => {
    expect(puedeEditarRevisionLegal({ role: "admin", abogadoId: null }, { ...ticket, estatus: "Pre-Cierre" })).toBe(false);
    expect(puedeEditarRevisionLegal({ role: "admin", abogadoId: null }, { ...ticket, altaArrendador: undefined })).toBe(false);
  });
});
