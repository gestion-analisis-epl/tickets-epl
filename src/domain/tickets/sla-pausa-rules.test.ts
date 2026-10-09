import { describe, it, expect } from "vitest";
import { diasHabilesEnPausa, diasHabilesSla, slaEnPausa, ESTATUS_PAUSA_SLA } from "./sla-pausa-rules";
import type { HistorialEntry } from "@/types/ticket";

const h = (estatus: HistorialEntry["estatus"], fecha: string): HistorialEntry => ({ estatus, fecha, uid: "u1" });

// 2024-01-08 es lunes.
const ASIGNACION = "2024-01-08T09:00:00";

describe("slaEnPausa", () => {
  it("solo Pre-Cierre pausa el SLA", () => {
    expect(ESTATUS_PAUSA_SLA).toBe("Pre-Cierre");
    expect(slaEnPausa({ estatus: "Pre-Cierre" })).toBe(true);
    expect(slaEnPausa({ estatus: "Cierre" })).toBe(false);
    expect(slaEnPausa({ estatus: "Recepcion de solicitud" })).toBe(false);
  });
});

describe("diasHabilesSla", () => {
  it("un ticket que nunca paso por Pre-Cierre cuenta todos los dias (sin regresion)", () => {
    const t = { fechaAsignacion: ASIGNACION, historialEstatus: [h("Recepcion de solicitud", "2024-01-08T08:00:00")] };
    const hasta = new Date("2024-01-12T12:00:00");
    expect(diasHabilesEnPausa(t, hasta)).toBe(0);
    expect(diasHabilesSla(t, hasta)).toBe(4);
  });

  it("pausa abierta: los dias quedan congelados al entrar a Pre-Cierre", () => {
    const t = {
      fechaAsignacion: ASIGNACION,
      historialEstatus: [h("Recepcion de solicitud", "2024-01-08T08:00:00"), h("Pre-Cierre", "2024-01-10T10:00:00")],
    };
    expect(diasHabilesSla(t, new Date("2024-01-10T18:00:00"))).toBe(2);
    expect(diasHabilesSla(t, new Date("2024-01-17T12:00:00"))).toBe(2);
    expect(diasHabilesEnPausa(t, new Date("2024-01-17T12:00:00"))).toBe(5);
  });

  it("regresar a una etapa previa reanuda y acumula (2 antes + 1 despues = 3, no 6)", () => {
    const t = {
      fechaAsignacion: ASIGNACION,
      historialEstatus: [
        h("Recepcion de solicitud", "2024-01-08T08:00:00"),
        h("Pre-Cierre", "2024-01-10T10:00:00"), // miercoles
        h("Proceso en tramite", "2024-01-15T10:00:00"), // lunes (3 dias habiles de pausa, con fin de semana)
      ],
    };
    const hasta = new Date("2024-01-16T12:00:00");
    expect(diasHabilesEnPausa(t, hasta)).toBe(3);
    expect(diasHabilesSla(t, hasta)).toBe(3);
  });

  it("varios intervalos en Pre-Cierre se suman", () => {
    const t = {
      fechaAsignacion: ASIGNACION,
      historialEstatus: [
        h("Pre-Cierre", "2024-01-09T10:00:00"),
        h("Recepcion de solicitud", "2024-01-10T10:00:00"), // 1 dia
        h("Pre-Cierre", "2024-01-11T10:00:00"),
        h("Recepcion de solicitud", "2024-01-15T10:00:00"), // jue->lun = 2 dias
      ],
    };
    const hasta = new Date("2024-01-17T12:00:00");
    expect(diasHabilesEnPausa(t, hasta)).toBe(3);
    expect(diasHabilesSla(t, hasta)).toBe(7 - 3);
  });

  it("una pausa anterior a la reasignacion se recorta/ignora", () => {
    const t = {
      fechaAsignacion: "2024-01-15T09:00:00", // lunes, reasignacion
      historialEstatus: [
        h("Pre-Cierre", "2024-01-09T10:00:00"),
        h("Recepcion de solicitud", "2024-01-12T10:00:00"), // termina antes de la asignacion
        h("Pre-Cierre", "2024-01-14T10:00:00"), // domingo, se recorta a 01-15
        h("Recepcion de solicitud", "2024-01-17T10:00:00"),
      ],
    };
    const hasta = new Date("2024-01-19T12:00:00");
    expect(diasHabilesEnPausa(t, hasta)).toBe(2); // lun15 -> mie17
    expect(diasHabilesSla(t, hasta)).toBe(4 - 2);
  });

  it("fechaAsignacion null devuelve 0", () => {
    const t = { fechaAsignacion: null, historialEstatus: [h("Pre-Cierre", "2024-01-10T10:00:00")] };
    expect(diasHabilesSla(t, new Date("2024-01-17T12:00:00"))).toBe(0);
    expect(diasHabilesEnPausa(t, new Date("2024-01-17T12:00:00"))).toBe(0);
  });

  it("nunca baja de 0", () => {
    const t = {
      fechaAsignacion: ASIGNACION,
      historialEstatus: [h("Pre-Cierre", "2024-01-01T10:00:00")],
    };
    expect(diasHabilesSla(t, new Date("2024-01-12T12:00:00"))).toBe(0);
  });

  it("una pausa que empieza y termina el mismo dia calendario suma 0", () => {
    const t = {
      fechaAsignacion: ASIGNACION,
      historialEstatus: [h("Pre-Cierre", "2024-01-10T10:00:00"), h("Recepcion de solicitud", "2024-01-10T15:00:00")],
    };
    const hasta = new Date("2024-01-12T12:00:00");
    expect(diasHabilesEnPausa(t, hasta)).toBe(0);
    expect(diasHabilesSla(t, hasta)).toBe(4);
  });

  it("entradas Pre-Cierre consecutivas se fusionan en una sola pausa", () => {
    const t = {
      fechaAsignacion: ASIGNACION,
      historialEstatus: [
        h("Pre-Cierre", "2024-01-09T10:00:00"),
        h("Pre-Cierre", "2024-01-10T10:00:00"),
        h("Recepcion de solicitud", "2024-01-11T10:00:00"),
      ],
    };
    expect(diasHabilesEnPausa(t, new Date("2024-01-12T12:00:00"))).toBe(2);
  });

  it("historialEstatus undefined o null se trata como sin pausas y no lanza", () => {
    const hasta = new Date("2024-01-12T12:00:00");
    for (const historialEstatus of [undefined, null]) {
      const t = { fechaAsignacion: ASIGNACION, historialEstatus } as unknown as Parameters<typeof diasHabilesSla>[0];
      expect(diasHabilesEnPausa(t, hasta)).toBe(0);
      expect(diasHabilesSla(t, hasta)).toBe(4);
    }
  });

  it("ignora entradas Pre-Cierre con fecha invalida o ausente al iniciar una pausa", () => {
    const t = {
      fechaAsignacion: ASIGNACION,
      historialEstatus: [
        h("Pre-Cierre", "no-es-fecha"),
        { estatus: "Pre-Cierre", uid: "u1" } as unknown as HistorialEntry,
        h("Recepcion de solicitud", "2024-01-10T10:00:00"),
      ],
    };
    const hasta = new Date("2024-01-12T12:00:00");
    expect(diasHabilesEnPausa(t, hasta)).toBe(0);
    expect(diasHabilesSla(t, hasta)).toBe(4);
  });

  it("si la entrada que cierra la pausa tiene fecha invalida, la pausa termina en `hasta`", () => {
    const t = {
      fechaAsignacion: ASIGNACION,
      historialEstatus: [h("Pre-Cierre", "2024-01-10T10:00:00"), h("Recepcion de solicitud", "no-es-fecha")],
    };
    const hasta = new Date("2024-01-12T12:00:00");
    expect(diasHabilesEnPausa(t, hasta)).toBe(2);
    expect(diasHabilesSla(t, hasta)).toBe(2);
  });
});
