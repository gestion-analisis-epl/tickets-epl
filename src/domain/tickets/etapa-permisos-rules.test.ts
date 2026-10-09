import { describe, expect, it } from "vitest";
import {
  bloqueadoPorPreCierre,
  CAMPOS_PROCESO_PRE_CIERRE,
  camposPermitidosPorEtapa,
  puedeModificarCampos,
  solicitudEditable,
} from "./etapa-permisos-rules";
import { calcularPatchAsignacion } from "./asignacion-rules";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";

// Campos que de verdad cambian (lo que Firestore ve en diff().affectedKeys()).
function camposAfectados(antes: Ticket, patch: Partial<Ticket>): string[] {
  return (Object.keys(patch) as (keyof Ticket)[]).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(antes[k]));
}

describe("camposPermitidosPorEtapa", () => {
  it("en Pre-Cierre admin y gerente juridico solo tocan campos de proceso (incluida la reasignacion)", () => {
    expect(camposPermitidosPorEtapa("Pre-Cierre", "admin")).toEqual({ tipo: "solo", campos: CAMPOS_PROCESO_PRE_CIERRE });
    expect(camposPermitidosPorEtapa("Pre-Cierre", "gerente_juridico")).toEqual({ tipo: "solo", campos: CAMPOS_PROCESO_PRE_CIERRE });
    expect(puedeModificarCampos("Pre-Cierre", "admin", ["abogadoAsignadoId", "fechaAsignacion", "fechaCompromiso"])).toBe(true);
  });

  it("en Pre-Cierre nadie cambia descripcion, servicio, area, sitio, documentos ni datos del contrato", () => {
    for (const rol of ["admin", "gerente_juridico", "mesa_control", "abogado", "solicitante", "gerente_area"] as const) {
      for (const campo of ["descripcion", "servicioId", "areaEmpresa", "sitioArrendamiento", "documentacion", "contratoArrendamiento"]) {
        expect(puedeModificarCampos("Pre-Cierre", rol, [campo])).toBe(false);
      }
    }
  });

  it("Legal no admin nunca reasigna abogado", () => {
    expect(puedeModificarCampos("Proceso en tramite", "mesa_control", ["abogadoAsignadoId"])).toBe(false);
    expect(puedeModificarCampos("Pre-Cierre", "abogado", ["abogadoAsignadoId"])).toBe(false);
    expect(puedeModificarCampos("Proceso en tramite", "abogado", ["descripcion", "estatus"])).toBe(true);
  });

  it("el dueno edita su solicitud antes de Pre-Cierre, nada en Pre-Cierre y solo la calificacion en Cierre", () => {
    expect(puedeModificarCampos("Proceso en tramite", "solicitante", ["descripcion", "documentacion"])).toBe(true);
    expect(puedeModificarCampos("Pre-Cierre", "solicitante", ["descripcion"])).toBe(false);
    expect(puedeModificarCampos("Cierre", "solicitante", ["satisfaccion", "comentarioSatisfaccion"])).toBe(true);
    expect(puedeModificarCampos("Cierre", "solicitante", ["descripcion"])).toBe(false);
  });

  it("el jefe de zona y el rol sitios no editan tickets", () => {
    expect(camposPermitidosPorEtapa("Pre-Cierre", "jefe_zona")).toEqual({ tipo: "solo", campos: [] });
    expect(camposPermitidosPorEtapa("Proceso en tramite", "sitios")).toEqual({ tipo: "solo", campos: [] });
  });

  it("lo que escribe updateTicketAsignacion al salir de Pre-Cierre esta permitido", () => {
    const antes = buildTicket({
      estatus: "Pre-Cierre", abogadoAsignadoId: "AB1", fechaAsignacion: "2026-10-01T15:00:00.000Z",
      historialEstatus: [{ estatus: "Pre-Cierre", fecha: "2026-10-05T15:00:00.000Z", uid: "x" }],
    });
    for (const estatus of ["Cierre", "Proceso en tramite"] as const) {
      const { patch } = calcularPatchAsignacion(antes, { estatus, abogadoAsignadoId: "AB1", notasCierre: "listo" }, "u1", new Date("2026-10-09T15:00:00.000Z"));
      expect(puedeModificarCampos("Pre-Cierre", "admin", Object.keys(patch))).toBe(true);
      expect(puedeModificarCampos("Pre-Cierre", "abogado", camposAfectados(antes, patch))).toBe(true);
    }
  });

  it("la exclusion del pipeline es un campo de proceso", () => {
    expect(puedeModificarCampos("Pre-Cierre", "admin", ["excluidoDelPipeline"])).toBe(true);
  });
});

describe("solicitudEditable y bloqueadoPorPreCierre", () => {
  it("la solicitud se edita solo antes de Pre-Cierre", () => {
    expect(solicitudEditable("Proceso en tramite")).toBe(true);
    expect(solicitudEditable("Pre-Cierre")).toBe(false);
    expect(solicitudEditable("Cierre")).toBe(false);
  });

  it("el bloqueo de Pre-Cierre no aplica a Cierre (el sitio se sigue corrigiendo)", () => {
    expect(bloqueadoPorPreCierre("Pre-Cierre")).toBe(true);
    expect(bloqueadoPorPreCierre("Cierre")).toBe(false);
  });
});
