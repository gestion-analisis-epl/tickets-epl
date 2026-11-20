import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({ deleteTicketDocuments: async () => {} }));
import { createTicketService } from "./ticket-service";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import type { RegistroArchivo } from "@/types/archivo";
import type { CatalogoServicio } from "@/types/catalogo";
import type { CatalogoLookup } from "@/domain/catalogo/catalogo-lookup";
import type { ResumenContratoRepository } from "@/domain/contratos/resumen-contrato-repository";
import type { NewTicketBuilder, TicketRepository } from "./ticket-repository";
import type { TicketNotifier } from "./ticket-notifier";
import type { NuevoTicketInput } from "./nuevo-ticket";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/b/o/tickets%2Ft1%2F123_${nombre}?alt=media&token=x`;
const solicitante: ActorHistorial = { uid: "user-1", nombre: "Juan Perez", rol: "solicitante" };
const abogado: ActorHistorial = { uid: "u9", nombre: "Alejandra", rol: "abogado", abogadoId: "a1" };
const gerenteJuridico: ActorHistorial = { uid: "u3", nombre: "Gerente", rol: "gerente_juridico" };

interface Lote {
  id: string;
  patch: Partial<Ticket>;
  entradas: EntradaHistorial[];
  archivos: RegistroArchivo[];
}

function montar(ticket: Ticket, opts: { historialRoto?: boolean } = {}) {
  const lotes: Lote[] = [];
  const creados: { archivos: RegistroArchivo[] }[] = [];
  const historial: { id: string; entradas: EntradaHistorial[] }[] = [];
  const repo = {
    getById: async () => ({ ...ticket }),
    update: async (_: string, patch: Partial<Ticket>) => { Object.assign(ticket, patch); },
    updateConHistorial: async (id: string, patch: Partial<Ticket>, entradas: EntradaHistorial[], archivos: RegistroArchivo[] = []) => {
      lotes.push({ id, patch, entradas, archivos });
      Object.assign(ticket, patch);
    },
    create: async (build: NewTicketBuilder, archivos: RegistroArchivo[] = []) => {
      build({ id: "nuevo", folio: "JUR-0099" });
      creados.push({ archivos });
      return { id: "nuevo", folio: "JUR-0099" };
    },
    agregarHistorial: async (id: string, entradas: EntradaHistorial[]) => {
      if (opts.historialRoto) throw new Error("historial rechazado");
      historial.push({ id, entradas });
    },
    delete: async () => {},
  };
  const resumenes = { get: async () => null, upsert: async () => {}, updateEstatus: async () => {}, delete: async () => {} };
  const notifier: TicketNotifier = {
    ticketCambioEstatus: async () => {}, ticketAsignado: async () => {}, ticketReasignado: async () => {}, ticketCreado: async () => {},
  };
  const catalogo: CatalogoLookup = {
    findServicio: (id: string) =>
      ({ id, servicio: `Servicio ${id}`, categoria: "Contratos", puestoResponsable: "Abogado", slaInterno: 3 }) as unknown as CatalogoServicio,
  };
  const service = createTicketService(
    repo as unknown as TicketRepository,
    notifier,
    catalogo,
    resumenes as unknown as ResumenContratoRepository
  );
  return { service, lotes, creados, historial };
}

const INPUT: NuevoTicketInput = {
  solicitanteId: "user-1",
  solicitanteNombre: "Juan Perez",
  areaEmpresa: "Grupo EPL",
  servicioId: "JUR-C001",
  descripcion: "Alta",
  documentacion: [],
};

const registroCreacion: RegistroArchivo = {
  nombre: "Predial.pdf",
  ruta: "tickets-drafts/d1/1_Predial.pdf",
  origen: "documentacion",
  accion: "subido",
  fecha: "2026-11-20T16:00:00.000Z",
  actorUid: "user-1",
  actorNombre: "Juan Perez",
  actorRol: "solicitante",
};

describe("createTicket con archivos", () => {
  it("pasa los registros al repositorio y agrega su entrada al historial", async () => {
    const { service, creados, historial } = montar(buildTicket());
    await service.createTicket(INPUT, [registroCreacion]);
    expect(creados[0].archivos).toEqual([registroCreacion]);
    expect(historial).toHaveLength(1);
    expect(historial[0].id).toBe("nuevo");
    expect(historial[0].entradas.map((e) => e.tipo)).toEqual(["archivo_subido"]);
    expect(historial[0].entradas[0]).toMatchObject({ actorUid: "user-1", actorRol: "solicitante" });
  });

  it("sin archivos no toca el historial", async () => {
    const { service, historial } = montar(buildTicket());
    await service.createTicket(INPUT);
    expect(historial).toEqual([]);
  });

  it("si el historial falla el ticket ya creado no se pierde", async () => {
    const { service } = montar(buildTicket(), { historialRoto: true });
    await expect(service.createTicket(INPUT, [registroCreacion])).resolves.toEqual({ id: "nuevo", folio: "JUR-0099" });
  });
});

describe("updateTicketSolicitud registra quien sube y quien quita documentos", () => {
  it("un documento nuevo y uno quitado quedan registrados con el actor", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", documentacion: [url("Viejo.pdf")] }));
    await service.updateTicketSolicitud("t1", gerenteJuridico, {
      areaEmpresa: "A", servicioId: "s", descripcion: "d", documentacion: [url("Nuevo.pdf")],
    });
    const lote = lotes[0];
    expect(lote.archivos.map((r) => `${r.accion}:${r.nombre}:${r.actorRol}:${r.origen}`)).toEqual([
      "subido:Nuevo.pdf:gerente_juridico:documentacion",
      "eliminado:Viejo.pdf:gerente_juridico:documentacion",
    ]);
    expect(lote.entradas.filter((e) => e.tipo === "archivo_subido" || e.tipo === "archivo_eliminado")).toHaveLength(2);
  });

  it("si la documentación no cambia no registra archivos", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", documentacion: [url("A.pdf")] }));
    await service.updateTicketSolicitud("t1", solicitante, {
      areaEmpresa: "A", servicioId: "s", descripcion: "d", documentacion: [url("A.pdf")],
    });
    expect(lotes[0].archivos).toEqual([]);
  });
});

describe("updateTicketRevisionLegal registra los anexos del abogado", () => {
  it("un anexo nuevo queda con su campo y el abogado como autor", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", servicioId: "JUR-C071" }));
    await service.updateTicketRevisionLegal("t1", abogado, {
      tipoPropietario: "fisica",
      acreditaPropiedad: true,
      documentoPropiedad: url("Escrituras.pdf"),
    });
    expect(lotes[0].patch.revisionLegal?.documentoPropiedad).toBe(url("Escrituras.pdf"));
    expect(lotes[0].archivos).toHaveLength(1);
    expect(lotes[0].archivos[0]).toMatchObject({
      accion: "subido", origen: "revision_legal", campo: "documentoPropiedad", nombre: "Escrituras.pdf", actorRol: "abogado",
    });
    expect(lotes[0].entradas.map((e) => e.tipo)).toEqual(["archivo_subido"]);
  });
});

describe("updateTicketAltaRetroactiva registra los documentos que agrega el abogado", () => {
  it("un documento nuevo queda registrado con su clave", async () => {
    const { service, lotes } = montar(buildTicket({ id: "t1", servicioId: "JUR-C071" }));
    await service.updateTicketAltaRetroactiva("t1", abogado, {
      tipoAlta: "nuevo", motivoCambio: "", geolocalizacion: null, documentos: { predial: url("Predial.pdf") },
    });
    expect(lotes[0].archivos).toHaveLength(1);
    expect(lotes[0].archivos[0]).toMatchObject({ accion: "subido", origen: "alta", campo: "predial", actorRol: "abogado" });
  });

  it("un documento que ya había subido el solicitante en el formulario anterior no se atribuye al abogado", async () => {
    const ticket = buildTicket({
      id: "t1",
      servicioId: "JUR-C071",
      documentosArrendamiento: { predial: url("Predial.pdf") } as unknown as Ticket["documentosArrendamiento"],
    });
    const { service, lotes } = montar(ticket);
    await service.updateTicketAltaRetroactiva("t1", abogado, {
      tipoAlta: "nuevo", motivoCambio: "", geolocalizacion: null, documentos: { predial: url("Predial.pdf") },
    });
    expect(lotes[0].archivos).toEqual([]);
  });
});
