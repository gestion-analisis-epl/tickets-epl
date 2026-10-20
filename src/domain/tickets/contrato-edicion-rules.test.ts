import { describe, it, expect } from "vitest";
import { buildTicket } from "@/test/ticket-fixture";
import { calcularPatchContrato, puedeEditarContrato } from "./contrato-edicion-rules";
import { entradaContrato, esVisibleParaSolicitante, conVisibilidad } from "./historial-rules";
import type { ActorHistorial } from "@/types/historial";

const CONTRATO = {
  sitio: "Bodega vieja", domicilio: "Av. Reforma 1", altaArrendador: "Juan Perez", solicitante: "Ana Lopez",
  periodoInicio: "2026-01-01", periodoFin: "2027-01-01", condicionesPago: "63 - Transferencia", montoPago: 12500,
  motivo: "Alta de Arrendador", notas: "n",
};
const ticket = (extra = {}) =>
  buildTicket({ solicitanteId: "sol1", abogadoAsignadoId: "ab1", estatus: "Proceso en tramite", contratoArrendamiento: CONTRATO, ...extra });
const ABOGADO: ActorHistorial = { uid: "u-ab", nombre: "Abogada", rol: "abogado", abogadoId: "ab1" };

describe("puedeEditarContrato", () => {
  it("el abogado asignado puede", () => {
    expect(puedeEditarContrato({ role: "abogado", abogadoId: "ab1" }, ticket())).toBe(true);
  });
  it("otro abogado, mesa de control y solicitante no pueden", () => {
    expect(puedeEditarContrato({ role: "abogado", abogadoId: "ab2" }, ticket())).toBe(false);
    expect(puedeEditarContrato({ role: "mesa_control", abogadoId: null }, ticket())).toBe(false);
    expect(puedeEditarContrato({ role: "solicitante", abogadoId: null }, ticket())).toBe(false);
  });
  it("admin y gerente juridico pueden", () => {
    expect(puedeEditarContrato({ role: "admin", abogadoId: null }, ticket())).toBe(true);
    expect(puedeEditarContrato({ role: "gerente_juridico", abogadoId: null }, ticket())).toBe(true);
  });
  it("no en Pre-Cierre ni Cierre", () => {
    expect(puedeEditarContrato({ role: "admin", abogadoId: null }, ticket({ estatus: "Pre-Cierre" }))).toBe(false);
    expect(puedeEditarContrato({ role: "admin", abogadoId: null }, ticket({ estatus: "Cierre" }))).toBe(false);
  });
  it("no si el ticket no tiene datos de contrato", () => {
    expect(puedeEditarContrato({ role: "admin", abogadoId: null }, ticket({ contratoArrendamiento: undefined }))).toBe(false);
  });
});

describe("calcularPatchContrato", () => {
  it("conserva el sitio y las notas que la edicion no toca", () => {
    const patch = calcularPatchContrato(ticket(), {
      domicilio: "Nuevo", altaArrendador: "x", solicitante: "y", periodoInicio: "2026-02-01", periodoFin: "2027-02-01",
      condicionesPago: "01 - Cheques", montoPago: 99, motivo: "Cambio de Arrendador",
    });
    expect(patch.contratoArrendamiento).toMatchObject({ sitio: "Bodega vieja", notas: "n", domicilio: "Nuevo", montoPago: 99 });
  });
});

describe("entradaContrato", () => {
  const nuevo = { ...CONTRATO, domicilio: "Otro", montoPago: 15000, periodoFin: "2027-06-30" };

  it("registra solo los campos que cambiaron, con valores legibles", () => {
    const e = entradaContrato(ticket(), nuevo, ABOGADO, new Date("2026-10-20T12:00:00Z"))!;
    expect(e.tipo).toBe("contrato");
    expect(e.cambios.map((c) => c.campo)).toEqual(["domicilio", "periodoFin", "montoPago"]);
    expect(e.cambios.find((c) => c.campo === "periodoFin")).toMatchObject({ antes: "01/01/2027", despues: "30/06/2027" });
  });

  it("sin cambios no hay entrada", () => {
    expect(entradaContrato(ticket(), CONTRATO, ABOGADO, new Date())).toBeNull();
  });
});

describe("visibilidad del historial para el solicitante", () => {
  const t = ticket();
  it("ve lo del abogado asignado y lo propio", () => {
    expect(esVisibleParaSolicitante(ABOGADO, t)).toBe(true);
    expect(esVisibleParaSolicitante({ uid: "sol1", nombre: "S", rol: "solicitante" }, t)).toBe(true);
  });
  it("no ve lo de gerencia, admin, mesa de control ni de otro abogado", () => {
    for (const rol of ["gerente_juridico", "admin", "mesa_control"] as const) {
      expect(esVisibleParaSolicitante({ uid: "x", nombre: "X", rol, abogadoId: "ab1" }, t)).toBe(false);
    }
    expect(esVisibleParaSolicitante({ ...ABOGADO, abogadoId: "ab2" }, t)).toBe(false);
  });
  it("conVisibilidad marca cada entrada", () => {
    const e = entradaContrato(t, { ...CONTRATO, domicilio: "Otro" }, ABOGADO, new Date())!;
    expect(conVisibilidad([e], t, ABOGADO)[0].visibleSolicitante).toBe(true);
    expect(conVisibilidad([e], t, { ...ABOGADO, rol: "admin" })[0].visibleSolicitante).toBe(false);
  });
});
