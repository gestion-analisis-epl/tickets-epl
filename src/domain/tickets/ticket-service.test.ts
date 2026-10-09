import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({ deleteTicketDocuments: async () => {} }));
import { createTicketService } from "./ticket-service";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { CatalogoServicio } from "@/types/catalogo";
import type { CatalogoLookup } from "@/domain/catalogo/catalogo-lookup";
import type { ResumenContratoRepository } from "@/domain/contratos/resumen-contrato-repository";
import type { TicketNotifier } from "./ticket-notifier";
import type { TicketRepository } from "./ticket-repository";

type RepoFake = Pick<TicketRepository, "getById" | "update" | "delete">;
type ResumenesFake = Pick<ResumenContratoRepository, "get" | "upsert" | "updateEstatus" | "delete">;

const servicioFake = { servicio: "x", categoria: "Contratos", puestoResponsable: "Abogado", slaInterno: 3 } as unknown as CatalogoServicio;

function notifierFake(avisos: string[] = []): TicketNotifier {
  return {
    ticketCambioEstatus: async (i) => { avisos.push(i.estatus); },
    ticketAsignado: async () => {}, ticketReasignado: async () => {}, ticketCreado: async () => {},
  };
}

function montar(ticket: Ticket, opts: { resumenesRoto?: boolean; lecturas?: Ticket[] } = {}) {
  const resumenes = new Map<string, ResumenContrato>();
  const avisos: string[] = [];
  const borrados: string[] = [];
  const repo: RepoFake = {
    getById: async () => {
      const siguiente = opts.lecturas?.shift();
      return { ...(siguiente ?? ticket) };
    },
    update: async (_: string, patch: Partial<Ticket>) => { Object.assign(ticket, patch); },
    delete: async () => {},
  };
  const roto = async () => { throw new Error("boom"); };
  const repoResumenes: ResumenesFake = opts.resumenesRoto
    ? { get: roto, upsert: roto, updateEstatus: async () => {}, delete: roto }
    : {
        get: async (id: string) => resumenes.get(id) ?? null,
        upsert: async (r: ResumenContrato) => { resumenes.set(r.ticketId, r); },
        updateEstatus: async (id: string, estatus: ResumenContrato["estatus"]) => {
          const r = resumenes.get(id); if (r) r.estatus = estatus;
        },
        delete: async (id: string) => { borrados.push(id); resumenes.delete(id); },
      };
  const catalogo: CatalogoLookup = { findServicio: () => servicioFake };
  const service = createTicketService(
    repo as unknown as TicketRepository,
    notifierFake(avisos),
    catalogo,
    repoResumenes as unknown as ResumenContratoRepository
  );
  return { service, resumenes, avisos, borrados };
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
    const { service } = montar(ticket, { resumenesRoto: true });
    await expect(service.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"))).resolves.toBeUndefined();
    expect(ticket.estatus).toBe("Pre-Cierre");
  });
});

const CONTRATO_URL = "https://x.test/o/tickets%2Ft1%2F123_CONTRATO_ARRENDAMIENTO.docx?alt=media";
const solicitud = { areaEmpresa: "A", servicioId: "s", descripcion: "d", documentacion: [CONTRATO_URL] };

describe("carrera con la generacion de Gemini", () => {
  const listo = { estado: "listo" as const, extraccion: null, discrepancias: [], contratoNombre: null, generadoEn: null };

  it("al cambiar de estatus usa el resumenContrato mas reciente del ticket", async () => {
    const base = buildTicket({ id: "t1", resumenContrato: { ...listo, estado: "pendiente" } });
    const fresco = buildTicket({ id: "t1", resumenContrato: { ...listo, estado: "listo", discrepancias: [{ campo: "periodo", valorTicket: "a", valorContrato: "b" }] } });
    const { service, resumenes } = montar(base, { lecturas: [{ ...base }, fresco] });
    await service.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"));
    expect(resumenes.get("t1")?.discrepancias).toHaveLength(1);
  });
});

describe("refresco del resumen al editar el ticket", () => {
  it("editar la documentacion en Pre-Cierre refresca contratoUrl y conserva el visto bueno", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Pre-Cierre"));
    expect(resumenes.get("t1")?.contratoUrl).toBeNull();
    resumenes.get("t1")!.vistoBueno = { uid: "j1", nombre: "Jefe", fecha: "2026-10-08T00:00:00.000Z" };
    await service.updateTicketSolicitud("t1", solicitud);
    expect(resumenes.get("t1")?.contratoUrl).toBe(CONTRATO_URL);
    expect(resumenes.get("t1")?.vistoBueno?.uid).toBe("j1");
  });

  it("editar el sitio en Pre-Cierre refresca el sitio del resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", "u1", input("Cierre"));
    await service.updateTicketSitio("t1", "u2", { clave: "K1", alias: "Sitio Uno" });
    expect(resumenes.get("t1")?.sitioClave).toBe("K1");
    expect(resumenes.get("t1")?.sitioAlias).toBe("Sitio Uno");
  });

  it("editar en una etapa previa no crea resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketSolicitud("t1", solicitud);
    await service.updateTicketSitio("t1", "u2", { clave: "K1", alias: "S" });
    expect(resumenes.size).toBe(0);
  });

  it("si el resumen falla, la edicion guardada no se pierde", async () => {
    const ticket = buildTicket({ id: "t1", estatus: "Pre-Cierre" });
    const { service } = montar(ticket, { resumenesRoto: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(service.updateTicketSolicitud("t1", solicitud)).resolves.toBeUndefined();
    await expect(service.updateTicketSitio("t1", "u2", { clave: "K1", alias: "S" })).resolves.toBeUndefined();
    expect(ticket.documentacion).toEqual([CONTRATO_URL]);
    expect(ticket.sitioArrendamiento?.clave).toBe("K1");
  });
});

describe("deleteTicket", () => {
  it("borra tambien el resumen de contrato", async () => {
    const { service, borrados } = montar(buildTicket({ id: "t1" }));
    await service.deleteTicket("t1");
    expect(borrados).toEqual(["t1"]);
  });

  it("si borrar el resumen falla, no propaga el error", async () => {
    const { service } = montar(buildTicket({ id: "t1" }), { resumenesRoto: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(service.deleteTicket("t1")).resolves.toBeUndefined();
  });
});
