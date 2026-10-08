import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({ deleteTicketDocuments: async () => {} }));
import { createTicketService } from "./ticket-service";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";

function montar(ticket: Ticket) {
  const resumenes = new Map<string, ResumenContrato>();
  const avisos: string[] = [];
  const repo: any = {
    getById: async () => ({ ...ticket }),
    update: async (_: string, patch: Partial<Ticket>) => { Object.assign(ticket, patch); },
  };
  const notifier: any = {
    ticketCambioEstatus: async (i: { estatus: string }) => { avisos.push(i.estatus); },
    ticketAsignado: async () => {}, ticketReasignado: async () => {}, ticketCreado: async () => {},
  };
  const repoResumenes: any = {
    get: async (id: string) => resumenes.get(id) ?? null,
    upsert: async (r: ResumenContrato) => { resumenes.set(r.ticketId, r); },
    updateEstatus: async (id: string, estatus: ResumenContrato["estatus"]) => {
      const r = resumenes.get(id); if (r) r.estatus = estatus;
    },
  };
  const service = createTicketService(repo, notifier, { findServicio: () => undefined } as any, repoResumenes);
  return { service, resumenes, avisos };
}

const input = (estatus: Ticket["estatus"]) => ({ estatus, abogadoAsignadoId: null, notasCierre: null });

describe("sincronizacion del resumen de contrato", () => {
  it("al pasar a Pre-Cierre crea el resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"));
    expect(resumenes.get("t1")?.estatus).toBe("Pre-Cierre");
  });

  it("al pasar de Pre-Cierre a Cierre conserva el visto bueno", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"));
    resumenes.get("t1")!.vistoBueno = { uid: "j1", nombre: "Jefe", fecha: "2026-10-08T00:00:00.000Z" };
    await service.updateTicketAsignacion("t1", "u1", input("Cierre"));
    expect(resumenes.get("t1")?.estatus).toBe("Cierre");
    expect(resumenes.get("t1")?.vistoBueno?.uid).toBe("j1");
  });

  it("si el ticket regresa a una etapa previa solo actualiza el estatus del resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"));
    await service.updateTicketAsignacion("t1", "u1", input("Proceso en tramite"));
    expect(resumenes.get("t1")?.estatus).toBe("Proceso en tramite");
  });

  it("en etapas previas no crea resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Proceso en tramite"));
    expect(resumenes.size).toBe(0);
  });

  it("si el resumen falla, el cambio de estatus ya guardado no se pierde", async () => {
    const ticket = buildTicket({ id: "t1" });
    const roto: any = { get: async () => { throw new Error("boom"); }, upsert: async () => { throw new Error("boom"); }, updateEstatus: async () => {} };
    const s2 = createTicketService(
      { getById: async () => ({ ...ticket }), update: async (_: string, p: Partial<Ticket>) => { Object.assign(ticket, p); } } as any,
      { ticketCambioEstatus: async () => {}, ticketAsignado: async () => {}, ticketReasignado: async () => {}, ticketCreado: async () => {} } as any,
      { findServicio: () => undefined } as any,
      roto
    );
    await expect(s2.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"))).resolves.toBeUndefined();
    expect(ticket.estatus).toBe("Pre-Cierre");
  });
});
