import { describe, expect, it } from "vitest";
import { calcularDiscrepancias, normalizarTexto, textosEquivalentes } from "./discrepancias-rules";
import { buildTicket } from "@/test/ticket-fixture";
import type { ExtraccionContrato } from "@/types/resumen-contrato";

const vacia: ExtraccionContrato = {
  sitio: null, codigo: null, domicilio: null, altaArrendador: null, solicitante: null,
  periodoInicio: null, periodoFin: null, condicionesPago: null, montoPagoAnual: null, formaPago: null,
};

const ticketCon = (c: Partial<NonNullable<ReturnType<typeof buildTicket>["contratoArrendamiento"]>>) =>
  buildTicket({
    contratoArrendamiento: {
      domicilio: "Av. Constituyentes 100, Col. Centro, Queretaro", altaArrendador: "Juan Perez Garcia",
      solicitante: "Ana", periodoInicio: "2026-01-01", periodoFin: "2027-01-01",
      condicionesPago: "x", montoPago: 1, motivo: "m", ...c,
    },
  });

describe("normalizarTexto", () => {
  it("quita acentos, mayusculas y puntuacion", () => {
    expect(normalizarTexto("  Querétaro,  QRO. ")).toBe("queretaro qro");
  });
});

describe("textosEquivalentes", () => {
  it("tolera abreviaturas y formato distinto", () => {
    expect(textosEquivalentes("Av. Constituyentes 100, Col. Centro, Queretaro", "Avenida Constituyentes 100 Colonia Centro Queretaro Qro")).toBe(true);
  });
  it("detecta otro numero exterior", () => {
    expect(textosEquivalentes("Av. Constituyentes 100, Col. Centro, Queretaro", "Av. Constituyentes 200, Col. Centro, Queretaro")).toBe(false);
  });
  it("detecta otra direccion", () => {
    expect(textosEquivalentes("Av. Constituyentes 100, Col. Centro, Queretaro", "Calle Reforma 55, Col. Juarez, Leon")).toBe(false);
  });
  it("ignora la razon social SA de CV", () => {
    expect(textosEquivalentes("Inmuebles del Bajio S.A. de C.V.", "Inmuebles del Bajio")).toBe(true);
  });
});

describe("calcularDiscrepancias", () => {
  it("sin diferencias devuelve lista vacia", () => {
    const e = { ...vacia, domicilio: "Avenida Constituyentes 100 Colonia Centro Queretaro", altaArrendador: "Juan Perez Garcia", periodoInicio: "2026-01-01", periodoFin: "2027-01-01" };
    expect(calcularDiscrepancias(ticketCon({}), e)).toEqual([]);
  });

  it("marca domicilio distinto con ambos valores", () => {
    const d = calcularDiscrepancias(ticketCon({}), { ...vacia, domicilio: "Calle Reforma 55, Leon" });
    expect(d).toEqual([{ campo: "domicilio", valorTicket: "Av. Constituyentes 100, Col. Centro, Queretaro", valorContrato: "Calle Reforma 55, Leon" }]);
  });

  it("marca arrendador distinto", () => {
    const d = calcularDiscrepancias(ticketCon({}), { ...vacia, altaArrendador: "Maria Lopez Ruiz" });
    expect(d.map((x) => x.campo)).toEqual(["arrendador"]);
  });

  it("marca periodo si cambia inicio o fin", () => {
    const d = calcularDiscrepancias(ticketCon({}), { ...vacia, periodoFin: "2028-01-01" });
    expect(d).toEqual([{ campo: "periodo", valorTicket: "2026-01-01 a 2027-01-01", valorContrato: "2026-01-01 a 2028-01-01" }]);
  });

  it("no compara lo que el contrato no trae", () => {
    expect(calcularDiscrepancias(ticketCon({}), vacia)).toEqual([]);
  });

  it("un ticket sin contratoArrendamiento no genera discrepancias", () => {
    expect(calcularDiscrepancias(buildTicket(), { ...vacia, domicilio: "x 1" })).toEqual([]);
  });
});
