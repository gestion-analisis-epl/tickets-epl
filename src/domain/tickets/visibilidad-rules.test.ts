import { describe, expect, it } from "vitest";
import { combinarTickets, uidsConsultaTickets } from "./visibilidad-rules";
import { buildTicket } from "@/test/ticket-fixture";

describe("uidsConsultaTickets", () => {
  it("el solicitante solo consulta sus propios tickets", () => {
    expect(uidsConsultaTickets({ uid: "u1", role: "solicitante" })).toEqual(["u1"]);
  });

  it("el gerente de area consulta los suyos y los de sus supervisados", () => {
    expect(uidsConsultaTickets({ uid: "g1", role: "gerente_area", supervisaUids: ["a", "b"] })).toEqual(["g1", "a", "b"]);
  });

  it("el gerente de area sin supervisados solo ve los suyos", () => {
    expect(uidsConsultaTickets({ uid: "g1", role: "gerente_area" })).toEqual(["g1"]);
    expect(uidsConsultaTickets({ uid: "g1", role: "gerente_area", supervisaUids: [] })).toEqual(["g1"]);
  });

  it("no repite uids ni incluye vacios", () => {
    expect(uidsConsultaTickets({ uid: "g1", role: "gerente_area", supervisaUids: ["a", "a", "g1", ""] })).toEqual(["g1", "a"]);
  });

  it("un solicitante ignora supervisaUids aunque el documento los traiga", () => {
    expect(uidsConsultaTickets({ uid: "u1", role: "solicitante", supervisaUids: ["a"] })).toEqual(["u1"]);
  });

  it.each(["mesa_control", "abogado", "gerente_juridico", "admin"] as const)(
    "%s consulta todos los tickets (null)",
    (role) => {
      expect(uidsConsultaTickets({ uid: "x", role, supervisaUids: ["a"] })).toBeNull();
    }
  );
});

describe("combinarTickets", () => {
  it("junta varias listas y ordena del mas reciente al mas antiguo", () => {
    const a = buildTicket({ id: "a", fechaSolicitud: "2024-01-01T00:00:00.000Z" });
    const b = buildTicket({ id: "b", fechaSolicitud: "2024-03-01T00:00:00.000Z" });
    const c = buildTicket({ id: "c", fechaSolicitud: "2024-02-01T00:00:00.000Z" });

    expect(combinarTickets([[a], [b, c]]).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("no duplica un ticket que aparece en mas de una lista", () => {
    const a = buildTicket({ id: "a" });
    expect(combinarTickets([[a], [a]])).toHaveLength(1);
  });

  it("con listas vacias devuelve vacio", () => {
    expect(combinarTickets([[], []])).toEqual([]);
    expect(combinarTickets([])).toEqual([]);
  });
});
