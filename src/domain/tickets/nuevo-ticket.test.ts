import { describe, it, expect } from "vitest";
import { buildNuevoTicket, type NuevoTicketInput } from "./nuevo-ticket";
import type { CatalogoServicio } from "@/types/catalogo";

const SERVICIO: CatalogoServicio = {
  id: "JUR-C071",
  puestoResponsable: "Abogado Regional",
  servicio: "Alta de Arrendadores",
  solicitanteTipico: "Operaciones",
  categoria: "Contratos",
  slaInterno: 5,
  slaDespachoRef: 10,
};

const INPUT: NuevoTicketInput = {
  solicitanteId: "u1",
  solicitanteNombre: "Juan Perez",
  areaEmpresa: "Grupo EPL",
  servicioId: "JUR-C071",
  descripcion: "Alta",
  documentacion: [],
};

const build = (input: NuevoTicketInput) =>
  buildNuevoTicket(input, SERVICIO, { id: "t1", folio: "JUR-0001" }, new Date("2024-01-08T12:00:00.000Z"));

describe("buildNuevoTicket — sitio de arrendamiento", () => {
  it("guarda el sitio elegido (clave y alias) en el ticket", () => {
    const sitio = { clave: "C1", alias: "Alias A" };
    expect(build({ ...INPUT, sitioArrendamiento: sitio }).sitioArrendamiento).toEqual(sitio);
  });

  it("sin sitio no incluye la clave (Firestore rechaza undefined explicito)", () => {
    expect("sitioArrendamiento" in build(INPUT)).toBe(false);
  });
});
