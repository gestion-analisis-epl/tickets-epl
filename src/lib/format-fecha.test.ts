import { describe, it, expect } from "vitest";
import { formatFechaSolo } from "./format-fecha";

describe("formatFechaSolo", () => {
  it("formatea un yyyy-mm-dd sin retroceder un dia por zona horaria", () => {
    // Regresion: new Date("2024-01-15") se parsea como medianoche UTC: en una
    // maquina en America/Mexico_City (UTC-6) o cualquier zona detras de UTC,
    // formatearla con timeZone America/Mexico_City muestra 14 ene, no 15.
    expect(formatFechaSolo("2024-01-15")).toBe("15 ene 2024");
  });

  it("regresa un guion cuando no hay fecha", () => {
    expect(formatFechaSolo(null)).toBe("—");
    expect(formatFechaSolo(undefined)).toBe("—");
  });
});
