import { describe, it, expect } from "vitest";
import { calcularBackfill } from "./backfill-rules";
import { buildTicket } from "@/test/ticket-fixture";

describe("calcularBackfill", () => {
  it("excluye el tiempo en Pre-Cierre del SLA y deja diasPipeline total", () => {
    const t = buildTicket({
      fechaSolicitud: "2024-01-08T12:00:00",
      fechaAsignacion: "2024-01-08T12:00:00",
      fechaCierre: "2024-01-15T12:00:00",
      slaInterno: 5,
      historialEstatus: [
        { estatus: "Pre-Cierre", fecha: "2024-01-10T10:00:00", uid: "u1" },
        { estatus: "Cierre", fecha: "2024-01-15T12:00:00", uid: "u1" },
      ],
    });
    expect(calcularBackfill(t)).toEqual({ omitido: false, diasPipeline: 5, diasHabilesTranscurridos: 2, nivelServicio: 3 });
  });

  it("sin paso por Pre-Cierre cuenta todos los dias", () => {
    const t = buildTicket({
      fechaSolicitud: "2024-01-08T12:00:00",
      fechaAsignacion: "2024-01-08T12:00:00",
      fechaCierre: "2024-01-15T12:00:00",
      slaInterno: 5,
      historialEstatus: [],
    });
    expect(calcularBackfill(t)).toEqual({ omitido: false, diasPipeline: 5, diasHabilesTranscurridos: 5, nivelServicio: 0 });
  });
});
