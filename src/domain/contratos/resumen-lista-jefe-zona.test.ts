import { describe, expect, it } from "vitest";
import { enCorreccion, ordenarResumenesJefeZona } from "./resumen-presentacion";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { Estatus } from "@/types/ticket";

describe("lista del jefe de zona", () => {
  it("en correccion: ya paso por Pre-Cierre y regreso a una etapa anterior", () => {
    expect(enCorreccion("Proceso en tramite")).toBe(true);
    expect(enCorreccion("Pre-Cierre")).toBe(false);
    expect(enCorreccion("Cierre")).toBe(false);
  });

  it("ordena Pre-Cierre, luego en correccion, luego Cierre; lo mas reciente arriba en cada grupo", () => {
    const r = (ticketId: string, estatus: Estatus, actualizadoEn: string) =>
      ({ ticketId, estatus, actualizadoEn }) as unknown as ResumenContrato;
    const lista = [
      r("c", "Cierre", "2026-10-09T00:00:00.000Z"),
      r("p1", "Pre-Cierre", "2026-10-01T00:00:00.000Z"),
      r("e", "Proceso en tramite", "2026-10-08T00:00:00.000Z"),
      r("p2", "Pre-Cierre", "2026-10-05T00:00:00.000Z"),
    ];
    expect(ordenarResumenesJefeZona(lista).map((x) => x.ticketId)).toEqual(["p2", "p1", "e", "c"]);
    expect(lista[0].ticketId).toBe("c"); // no muta la entrada
  });
});
