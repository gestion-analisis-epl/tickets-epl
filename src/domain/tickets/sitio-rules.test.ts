import { describe, it, expect } from "vitest";
import { calcularPatchSitio, puedeActualizarSitio } from "./sitio-rules";
import { buildTicket } from "@/test/ticket-fixture";
import type { Role } from "@/types/user";

describe("calcularPatchSitio", () => {
  it("guarda el sitio y registra quien y cuando lo actualizo", () => {
    const ahora = new Date("2024-02-01T15:00:00.000Z");
    const patch = calcularPatchSitio({ clave: "C1", alias: "Alias A" }, "mesa-1", ahora);

    expect(patch).toEqual({
      sitioArrendamiento: { clave: "C1", alias: "Alias A" },
      sitioActualizadoPor: "mesa-1",
      sitioActualizadoEn: "2024-02-01T15:00:00.000Z",
    });
  });

  it("no arrastra campos extra del objeto recibido", () => {
    const conExtra = { clave: "C", alias: "A", anunId: "1", vista: "V" };
    expect(calcularPatchSitio(conExtra, "u", new Date()).sitioArrendamiento).toStrictEqual({ clave: "C", alias: "A" });
  });
});

describe("puedeActualizarSitio", () => {
  const ticketArrendamiento = buildTicket({ servicioId: "JUR-C073" });

  it.each<[Role, boolean]>([
    ["mesa_control", true],
    ["admin", true],
    ["gerente_juridico", true],
    ["abogado", false],
    ["solicitante", false],
  ])("rol %s -> %s", (role, esperado) => {
    expect(puedeActualizarSitio(role, ticketArrendamiento)).toBe(esperado);
  });

  it("sin rol no puede", () => {
    expect(puedeActualizarSitio(null, ticketArrendamiento)).toBe(false);
  });

  it("solo aplica a los servicios de arrendamiento", () => {
    expect(puedeActualizarSitio("admin", buildTicket({ servicioId: "JUR-C001" }))).toBe(false);
  });

  it.each(["JUR-C071", "JUR-C072", "JUR-C073", "JUR-C074"])("aplica al servicio %s", (servicioId) => {
    expect(puedeActualizarSitio("mesa_control", buildTicket({ servicioId }))).toBe(true);
  });
});
