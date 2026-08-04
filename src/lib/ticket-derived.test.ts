import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { withLiveDerivedFields } from "./ticket-derived";
import { buildTicket } from "@/test/ticket-fixture";

// "Hoy" fijo para que diasPipeline / diasHabilesTranscurridos sean deterministas:
// Lunes 2024-01-15.
const HOY = new Date("2024-01-15T12:00:00");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withLiveDerivedFields", () => {
  it("no toca un ticket ya cerrado (los campos quedan congelados)", () => {
    const cerrado = buildTicket({
      fechaCierre: "2024-01-10T00:00:00.000Z",
      diasPipeline: 99,
      diasHabilesTranscurridos: 99,
      nivelServicio: -99,
    });

    const result = withLiveDerivedFields(cerrado);

    expect(result).toBe(cerrado);
    expect(result.diasPipeline).toBe(99);
    expect(result.diasHabilesTranscurridos).toBe(99);
    expect(result.nivelServicio).toBe(-99);
  });

  it("sin abogado asignado: calcula diasPipeline contra hoy y deja el SLA sin iniciar", () => {
    const abierto = buildTicket({
      fechaSolicitud: "2024-01-08T12:00:00.000Z", // Lunes
      fechaAsignacion: null,
    });

    const result = withLiveDerivedFields(abierto);

    // Lunes 08 -> Lunes 15 = 5 dias habiles
    expect(result.diasPipeline).toBe(5);
    expect(result.diasHabilesTranscurridos).toBeNull();
    expect(result.nivelServicio).toBeNull();
  });

  it("con abogado asignado: calcula dias habiles transcurridos y nivel de servicio contra hoy", () => {
    const enProceso = buildTicket({
      fechaSolicitud: "2024-01-08T12:00:00.000Z", // Lunes
      fechaAsignacion: "2024-01-10T09:00:00.000Z", // Miercoles
      slaInterno: 5,
    });

    const result = withLiveDerivedFields(enProceso);

    // Lunes 08 -> Lunes 15 = 5 dias habiles de pipeline
    expect(result.diasPipeline).toBe(5);
    // Miercoles 10 -> Lunes 15 = 3 dias habiles transcurridos desde la asignacion
    expect(result.diasHabilesTranscurridos).toBe(3);
    // nivelServicio = slaInterno - diasHabilesTranscurridos = 5 - 3
    expect(result.nivelServicio).toBe(2);
  });

  it("no muta el ticket original al calcular los campos derivados", () => {
    const abierto = buildTicket({ fechaAsignacion: null, diasPipeline: null });
    withLiveDerivedFields(abierto);
    expect(abierto.diasPipeline).toBeNull();
  });
});
