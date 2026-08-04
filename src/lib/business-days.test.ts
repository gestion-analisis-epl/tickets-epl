import { describe, it, expect } from "vitest";
import { addBusinessDays, businessDaysBetween } from "./business-days";

describe("addBusinessDays", () => {
  it("avanza dias habiles simples sin cruzar fin de semana", () => {
    // Lunes 2024-01-01 + 1 dia habil = Martes 2024-01-02
    const result = addBusinessDays(new Date("2024-01-01T00:00:00"), 1);
    expect(result.toISOString().slice(0, 10)).toBe("2024-01-02");
  });

  it("salta el fin de semana al calcular", () => {
    // Viernes 2024-01-05 + 1 dia habil = Lunes 2024-01-08 (salta sabado y domingo)
    const result = addBusinessDays(new Date("2024-01-05T00:00:00"), 1);
    expect(result.toISOString().slice(0, 10)).toBe("2024-01-08");
  });

  it("acumula varios dias habiles saltando el fin de semana intermedio", () => {
    // Lunes 2024-01-01 + 5 dias habiles = Lunes 2024-01-08
    const result = addBusinessDays(new Date("2024-01-01T00:00:00"), 5);
    expect(result.toISOString().slice(0, 10)).toBe("2024-01-08");
  });

  it("con 0 dias regresa la misma fecha de inicio", () => {
    const start = new Date("2024-01-01T00:00:00");
    const result = addBusinessDays(start, 0);
    expect(result.toISOString().slice(0, 10)).toBe("2024-01-01");
  });

  it("redondea SLAs de medio dia (0.5) a 1 dia habil completo", () => {
    const conMedioDia = addBusinessDays(new Date("2024-01-01T00:00:00"), 0.5);
    const conUnDia = addBusinessDays(new Date("2024-01-01T00:00:00"), 1);
    expect(conMedioDia.toISOString()).toBe(conUnDia.toISOString());
  });

  it("no muta la fecha de inicio recibida", () => {
    const start = new Date("2024-01-01T00:00:00");
    const startCopy = new Date(start);
    addBusinessDays(start, 3);
    expect(start.toISOString()).toBe(startCopy.toISOString());
  });
});

describe("businessDaysBetween", () => {
  it("regresa 0 para el mismo dia, sin importar la hora", () => {
    const start = new Date("2024-01-01T09:00:00");
    const end = new Date("2024-01-01T18:00:00");
    expect(businessDaysBetween(start, end)).toBe(0);
  });

  it("cuenta solo dias habiles completos entre dos fechas (excluye el dia de inicio)", () => {
    // Lunes 2024-01-01 -> Lunes 2024-01-08: 5 dias habiles (Mar-Vie + el Lunes final)
    const dias = businessDaysBetween(new Date("2024-01-01T00:00:00"), new Date("2024-01-08T00:00:00"));
    expect(dias).toBe(5);
  });

  it("no cuenta el fin de semana como dias habiles", () => {
    // Viernes 2024-01-05 -> Lunes 2024-01-08: solo 1 dia habil (el propio Lunes)
    const dias = businessDaysBetween(new Date("2024-01-05T00:00:00"), new Date("2024-01-08T00:00:00"));
    expect(dias).toBe(1);
  });

  it("regresa 0 cuando la fecha final es anterior a la de inicio", () => {
    const dias = businessDaysBetween(new Date("2024-01-08T00:00:00"), new Date("2024-01-05T00:00:00"));
    expect(dias).toBe(0);
  });
});
