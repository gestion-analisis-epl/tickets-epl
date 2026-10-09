import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({ deleteTicketDocuments: async () => {} }));
import { createTicketService } from "./ticket-service";
import { MENSAJE_BLOQUEO_PRE_CIERRE } from "./etapa-permisos-rules";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { CatalogoServicio } from "@/types/catalogo";
import type { CatalogoLookup } from "@/domain/catalogo/catalogo-lookup";
import type { ResumenContratoRepository } from "@/domain/contratos/resumen-contrato-repository";
import type { TicketNotifier } from "./ticket-notifier";
import type { TicketRepository } from "./ticket-repository";

type RepoFake = Pick<TicketRepository, "getById" | "update" | "updateConHistorial" | "delete">;
type ResumenesFake = Pick<ResumenContratoRepository, "get" | "upsert" | "updateEstatus" | "delete">;

interface Lote {
  id: string;
  patch: Partial<Ticket>;
  entradas: EntradaHistorial[];
}

const servicioFake = { servicio: "x", categoria: "Contratos", puestoResponsable: "Abogado", slaInterno: 3 } as unknown as CatalogoServicio;
const actor: ActorHistorial = { uid: "u1", nombre: "Ana Legal", rol: "admin" };
const actorMesa: ActorHistorial = { uid: "u2", nombre: "Mesa", rol: "mesa_control" };

function notifierFake(avisos: string[] = []): TicketNotifier {
  return {
    ticketCambioEstatus: async (i) => { avisos.push(i.estatus); },
    ticketAsignado: async () => {}, ticketReasignado: async () => {}, ticketCreado: async () => {},
  };
}

function montar(ticket: Ticket, opts: { resumenesRoto?: boolean; lecturas?: Ticket[]; loteRoto?: boolean } = {}) {
  const resumenes = new Map<string, ResumenContrato>();
  const avisos: string[] = [];
  const borrados: string[] = [];
  const lotes: Lote[] = [];
  const repo: RepoFake = {
    getById: async () => {
      const siguiente = opts.lecturas?.shift();
      return { ...(siguiente ?? ticket) };
    },
    update: async (_: string, patch: Partial<Ticket>) => { Object.assign(ticket, patch); },
    updateConHistorial: async (id: string, patch: Partial<Ticket>, entradas: EntradaHistorial[]) => {
      if (opts.loteRoto) throw new Error("lote rechazado");
      lotes.push({ id, patch, entradas });
      Object.assign(ticket, patch);
    },
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
  const catalogo: CatalogoLookup = { findServicio: (id: string) => ({ ...servicioFake, servicio: `Servicio ${id}` }) };
  const service = createTicketService(
    repo as unknown as TicketRepository,
    notifierFake(avisos),
    catalogo,
    repoResumenes as unknown as ResumenContratoRepository
  );
  return { service, resumenes, avisos, borrados, lotes };
}

const input = (estatus: Ticket["estatus"]) => ({ estatus, abogadoAsignadoId: null, notasCierre: null });

describe("sincronizacion del resumen de contrato", () => {
  it("al pasar a Pre-Cierre crea el resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    expect(resumenes.get("t1")?.estatus).toBe("Pre-Cierre");
  });

  it("al pasar de Pre-Cierre a Cierre conserva el visto bueno", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    resumenes.get("t1")!.vistoBueno = { uid: "j1", nombre: "Jefe", fecha: "2026-10-08T00:00:00.000Z" };
    await service.updateTicketAsignacion("t1", actor, input("Cierre"));
    expect(resumenes.get("t1")?.estatus).toBe("Cierre");
    expect(resumenes.get("t1")?.vistoBueno?.uid).toBe("j1");
  });

  it("si el ticket regresa a una etapa previa solo actualiza el estatus del resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    await service.updateTicketAsignacion("t1", actor, input("Proceso en tramite"));
    expect(resumenes.get("t1")?.estatus).toBe("Proceso en tramite");
  });

  it("en etapas previas no crea resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Proceso en tramite"));
    expect(resumenes.size).toBe(0);
  });

  it("si el resumen falla, el cambio de estatus ya guardado no se pierde", async () => {
    const ticket = buildTicket({ id: "t1" });
    const { service } = montar(ticket, { resumenesRoto: true });
    await expect(service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"))).resolves.toBeUndefined();
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
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    expect(resumenes.get("t1")?.discrepancias).toHaveLength(1);
  });
});

describe("refresco del resumen al editar el ticket", () => {
  it("editar la documentacion en Cierre refresca contratoUrl y conserva el visto bueno", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Cierre"));
    expect(resumenes.get("t1")?.contratoUrl).toBeNull();
    resumenes.get("t1")!.vistoBueno = { uid: "j1", nombre: "Jefe", fecha: "2026-10-08T00:00:00.000Z" };
    await service.updateTicketSolicitud("t1", actor, solicitud);
    expect(resumenes.get("t1")?.contratoUrl).toBe(CONTRATO_URL);
    expect(resumenes.get("t1")?.vistoBueno?.uid).toBe("j1");
  });

  it("editar el sitio en Pre-Cierre refresca el sitio del resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Cierre"));
    await service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "Sitio Uno" });
    expect(resumenes.get("t1")?.sitioClave).toBe("K1");
    expect(resumenes.get("t1")?.sitioAlias).toBe("Sitio Uno");
  });

  it("editar en una etapa previa no crea resumen", async () => {
    const { service, resumenes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketSolicitud("t1", actor, solicitud);
    await service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "S" });
    expect(resumenes.size).toBe(0);
  });

  it("si el resumen falla, la edicion guardada no se pierde", async () => {
    const ticket = buildTicket({ id: "t1", estatus: "Cierre" });
    const { service } = montar(ticket, { resumenesRoto: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(service.updateTicketSolicitud("t1", actor, solicitud)).resolves.toBeUndefined();
    await expect(service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "S" })).resolves.toBeUndefined();
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

describe("historial en el mismo lote que el cambio", () => {
  it("un cambio de estatus escribe ticket y entrada en una sola operacion", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Proceso en tramite"));
    expect(lotes).toHaveLength(1);
    expect(lotes[0].patch.estatus).toBe("Proceso en tramite");
    expect(lotes[0].entradas).toHaveLength(1);
    expect(lotes[0].entradas[0]).toMatchObject({ tipo: "estatus", actorUid: "u1", actorNombre: "Ana Legal", actorRol: "admin" });
    expect(lotes[0].entradas[0].cambios).toEqual([
      { campo: "estatus", etiqueta: "Estatus", antes: "Recepcion de solicitud", despues: "Proceso en tramite" },
    ]);
  });

  it("historialEstatus (del que depende el SLA) se sigue actualizando aparte", async () => {
    const ticket = buildTicket({ id: "t1" });
    const { service } = montar(ticket);
    await service.updateTicketAsignacion("t1", actor, input("Pre-Cierre"));
    expect(ticket.historialEstatus).toEqual([{ estatus: "Pre-Cierre", fecha: expect.any(String), uid: "u1" }]);
  });

  it("guardar sin cambios efectivos no crea entradas", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, input("Recepcion de solicitud"));
    expect(lotes[0].entradas).toEqual([]);
  });

  it("asignar abogado y escribir notas generan entradas separadas", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketAsignacion("t1", actor, {
      estatus: "Recepcion de solicitud",
      abogadoAsignadoId: "Karina Valenzuela - Abogado Corporativo",
      notasCierre: "Revisar anexo",
    });
    expect(lotes[0].entradas.map((e) => e.tipo)).toEqual(["asignacion", "notas_cierre"]);
    expect(lotes[0].entradas[0].cambios[0]).toEqual({
      campo: "abogadoAsignadoId", etiqueta: "Abogado asignado", antes: null, despues: "Karina Valenzuela",
    });
  });

  it("editar la solicitud registra la edicion y los documentos en el mismo lote", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketSolicitud("t1", actor, solicitud);
    expect(lotes).toHaveLength(1);
    expect(lotes[0].entradas.map((e) => e.tipo)).toEqual(["solicitud", "documentos"]);
    expect(lotes[0].entradas[0].cambios.map((c) => c.campo)).toEqual(["areaEmpresa", "servicioId", "descripcion", "slaInterno"]);
    expect(lotes[0].entradas[1].cambios).toEqual([
      { campo: "documentacion", etiqueta: "Documentacion", antes: null, despues: "CONTRATO_ARRENDAMIENTO.docx" },
    ]);
  });

  it("cambiar el sitio registra antes y despues con el rol de quien lo hizo", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "Sitio Uno" });
    expect(lotes[0].entradas).toEqual([
      expect.objectContaining({
        tipo: "sitio",
        actorRol: "mesa_control",
        cambios: [{ campo: "sitioArrendamiento", etiqueta: "Sitio", antes: null, despues: "K1 — Sitio Uno" }],
      }),
    ]);
  });

  it("excluir del pipeline registra si/no y repetirlo no agrega entrada", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1" }));
    await service.updateTicketExclusion("t1", actor, true);
    await service.updateTicketExclusion("t1", actor, true);
    expect(lotes[0].entradas[0].cambios).toEqual([
      { campo: "excluidoDelPipeline", etiqueta: "Excluido del pipeline", antes: "no", despues: "sí" },
    ]);
    expect(lotes[1].entradas).toEqual([]);
  });

  it("si el lote falla no se guarda nada, no se avisa y el error llega a quien llamo", async () => {
    const ticket = buildTicket({ id: "t1" });
    const { service, avisos } = montar(ticket, { loteRoto: true });
    await expect(service.updateTicketAsignacion("t1", actor, input("Proceso en tramite"))).rejects.toThrow("lote rechazado");
    expect(ticket.estatus).toBe("Recepcion de solicitud");
    expect(avisos).toEqual([]);
  });
});

describe("bloqueo de la solicitud en Pre-Cierre", () => {
  it("rechaza editar la solicitud y el sitio sin escribir nada", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", estatus: "Pre-Cierre" }));
    await expect(service.updateTicketSolicitud("t1", actor, solicitud)).rejects.toThrow(MENSAJE_BLOQUEO_PRE_CIERRE);
    await expect(service.updateTicketSitio("t1", actorMesa, { clave: "K1", alias: "S" })).rejects.toThrow(MENSAJE_BLOQUEO_PRE_CIERRE);
    expect(lotes).toEqual([]);
  });

  it("en Pre-Cierre si se permiten los cambios de proceso", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", estatus: "Pre-Cierre" }));
    await service.updateTicketExclusion("t1", actor, true);
    await service.updateTicketAsignacion("t1", actor, input("Cierre"));
    expect(lotes).toHaveLength(2);
  });
});
