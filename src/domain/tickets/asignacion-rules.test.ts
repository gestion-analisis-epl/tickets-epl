import { describe, it, expect } from "vitest";
import { calcularPatchAsignacion } from "./asignacion-rules";
import { addBusinessDays, businessDaysBetween } from "@/lib/business-days";
import { buildTicket } from "@/test/ticket-fixture";

describe("calcularPatchAsignacion", () => {
  it("el SLA arranca al asignar abogado por primera vez, no antes", () => {
    const current = buildTicket({
      estatus: "Recepcion de solicitud",
      abogadoAsignadoId: null,
      fechaAsignacion: null,
      slaInterno: 5,
    });
    const ahora = new Date("2024-01-10T12:00:00.000Z"); // Miercoles

    const { patch, esNuevaAsignacion, esCambioEstatus } = calcularPatchAsignacion(
      current,
      { estatus: "Recepcion de solicitud", abogadoAsignadoId: "ab1", notasCierre: null },
      "actor-1",
      ahora
    );

    expect(patch.fechaAsignacion).toBe(ahora.toISOString());
    expect(patch.fechaCompromiso).toBe(addBusinessDays(ahora, 5).toISOString());
    expect(esNuevaAsignacion).toBe(true);
    expect(esCambioEstatus).toBe(false);
  });

  it("sin abogado asignado, el SLA sigue sin iniciar (fechaAsignacion/fechaCompromiso quedan fuera del patch)", () => {
    const current = buildTicket({ abogadoAsignadoId: null, fechaAsignacion: null });
    const { patch } = calcularPatchAsignacion(
      current,
      { estatus: current.estatus, abogadoAsignadoId: null, notasCierre: null },
      "actor-1",
      new Date("2024-01-10T12:00:00.000Z")
    );

    expect(patch.fechaAsignacion).toBeUndefined();
    expect(patch.fechaCompromiso).toBeUndefined();
  });

  it("reasignar a un abogado distinto reinicia fechaAsignacion/fechaCompromiso (el SLA arranca de cero)", () => {
    const current = buildTicket({
      abogadoAsignadoId: "ab1",
      fechaAsignacion: "2024-01-08T12:00:00.000Z",
      slaInterno: 5,
    });
    const ahora = new Date("2024-01-12T12:00:00.000Z");
    const { patch, esNuevaAsignacion, esReasignacion } = calcularPatchAsignacion(
      current,
      { estatus: current.estatus, abogadoAsignadoId: "ab2", notasCierre: null },
      "actor-1",
      ahora
    );

    expect(patch.fechaAsignacion).toBe(ahora.toISOString());
    expect(patch.fechaCompromiso).toBe(addBusinessDays(ahora, 5).toISOString());
    expect(patch.abogadoAsignadoId).toBe("ab2");
    expect(esNuevaAsignacion).toBe(true); // el aviso de "te asignaron" si debe dispararse otra vez
    expect(esReasignacion).toBe(true); // distingue el correo de reasignacion del de primera asignacion
  });

  it("al cerrar por primera vez congela diasPipeline/diasHabilesTranscurridos/nivelServicio y genera token de calificacion", () => {
    const fechaSolicitud = "2024-01-08T12:00:00.000Z"; // Lunes
    const fechaAsignacion = "2024-01-10T12:00:00.000Z"; // Miercoles
    const current = buildTicket({
      fechaSolicitud,
      fechaAsignacion,
      slaInterno: 5,
      estatus: "Proceso en tramite",
      abogadoAsignadoId: "ab1",
      fechaCierre: null,
    });
    const ahora = new Date("2024-01-15T12:00:00.000Z"); // Lunes

    const { patch, esCambioEstatus } = calcularPatchAsignacion(
      current,
      { estatus: "Cierre", abogadoAsignadoId: "ab1", notasCierre: "listo" },
      "actor-1",
      ahora
    );

    expect(patch.fechaCierre).toBe(ahora.toISOString());
    expect(patch.diasPipeline).toBe(businessDaysBetween(new Date(fechaSolicitud), ahora));
    expect(patch.diasHabilesTranscurridos).toBe(businessDaysBetween(new Date(fechaAsignacion), ahora));
    expect(patch.nivelServicio).toBe(current.slaInterno - patch.diasHabilesTranscurridos!);
    expect(typeof patch.tokenCalificacion).toBe("string");
    expect(esCambioEstatus).toBe(true);
  });

  it("re-cerrar un ticket ya cerrado no recalcula el SLA congelado, pero si regenera el token si se habia reabierto", () => {
    const current = buildTicket({
      estatus: "Proceso en tramite", // reabierto despues de un primer cierre
      fechaCierre: "2024-01-10T00:00:00.000Z", // valor ya congelado del primer cierre
      diasPipeline: 5,
      diasHabilesTranscurridos: 3,
      nivelServicio: 2,
    });

    const { patch } = calcularPatchAsignacion(
      current,
      { estatus: "Cierre", abogadoAsignadoId: current.abogadoAsignadoId, notasCierre: null },
      "actor-1",
      new Date("2024-01-20T12:00:00.000Z")
    );

    // El bloque de fechaCierre/diasPipeline no se toca porque current.fechaCierre ya existia.
    expect(patch.fechaCierre).toBeUndefined();
    expect(patch.diasPipeline).toBeUndefined();
    // Pero el token si se regenera: current.estatus ("Proceso en tramite") != "Cierre".
    expect(typeof patch.tokenCalificacion).toBe("string");
  });

  it("historialEstatus solo agrega una entrada cuando el estatus realmente cambia", () => {
    const current = buildTicket({ estatus: "Recepcion de solicitud", historialEstatus: [] });
    const ahora = new Date("2024-01-10T12:00:00.000Z");

    const sinCambio = calcularPatchAsignacion(
      current,
      { estatus: "Recepcion de solicitud", abogadoAsignadoId: null, notasCierre: null },
      "actor-1",
      ahora
    );
    expect(sinCambio.patch.historialEstatus).toEqual([]);

    const conCambio = calcularPatchAsignacion(
      current,
      { estatus: "Asignacion de responsable", abogadoAsignadoId: null, notasCierre: null },
      "actor-1",
      ahora
    );
    expect(conCambio.patch.historialEstatus).toEqual([
      { estatus: "Asignacion de responsable", fecha: ahora.toISOString(), uid: "actor-1" },
    ]);
  });
});
