import { describe, expect, it, vi } from "vitest";
import { pedirCambios, PedirCambiosError, type DepsPedirCambios, type OperacionPedirCambios } from "./pedir-cambios-service";
import { diasHabilesEnPausa } from "./sla-pausa-rules";
import { businessDaysBetween } from "@/lib/business-days";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { Role } from "@/types/user";

const AHORA = new Date("2026-10-07T15:00:00.000Z");
const INICIO_PAUSA = "2026-10-05T15:00:00.000Z";
const FECHA_ASIGNACION = "2026-10-01T15:00:00.000Z";
const VISTO = { uid: "j1", nombre: "Jefe Uno", fecha: INICIO_PAUSA };

function ticketEnPreCierre(over: Partial<Ticket> = {}): Ticket {
  return buildTicket({
    id: "t1", folio: "JUR-0042", estatus: "Pre-Cierre", abogadoAsignadoId: "AB1", fechaAsignacion: FECHA_ASIGNACION,
    historialEstatus: [{ estatus: "Pre-Cierre", fecha: INICIO_PAUSA, uid: "legal" }],
    ...over,
  });
}

interface Opciones {
  role?: Role;
  activo?: boolean;
  ticket?: Ticket | null;
  resumen?: ResumenContrato | null;
  avisoRoto?: boolean;
}

function montar(opts: Opciones = {}) {
  const guardados: OperacionPedirCambios[] = [];
  const avisos: string[] = [];
  const deps: DepsPedirCambios = {
    cargarUsuario: async () => ({ nombre: "Jefe Uno", role: opts.role ?? "jefe_zona", activo: opts.activo ?? true }),
    cargarTicket: async () => (opts.ticket === undefined ? ticketEnPreCierre() : opts.ticket),
    cargarResumen: async () =>
      opts.resumen === undefined ? ({ ticketId: "t1", estatus: "Pre-Cierre", vistoBueno: VISTO } as unknown as ResumenContrato) : opts.resumen,
    nuevoIdComentario: () => "c1",
    guardar: async (op) => { guardados.push(op); },
    avisar: async (info) => {
      if (opts.avisoRoto) throw new Error("smtp");
      avisos.push(info.ticketId);
    },
    ahora: () => AHORA,
  };
  return { deps, guardados, avisos };
}

async function estado(promesa: Promise<unknown>): Promise<number | null> {
  try {
    await promesa;
    return null;
  } catch (err) {
    return err instanceof PedirCambiosError ? err.status : -1;
  }
}

describe("pedirCambios: validaciones", () => {
  it("solo un jefe de zona activo", async () => {
    const abogado = montar({ role: "abogado" });
    expect(await estado(pedirCambios(abogado.deps, "u1", "t1", "Corrige"))).toBe(403);
    const inactivo = montar({ activo: false });
    expect(await estado(pedirCambios(inactivo.deps, "j1", "t1", "Corrige"))).toBe(403);
    expect(abogado.guardados).toEqual([]);
  });

  it("exige un texto valido", async () => {
    const { deps, guardados } = montar();
    expect(await estado(pedirCambios(deps, "j1", "t1", "   "))).toBe(400);
    expect(await estado(pedirCambios(deps, "j1", "t1", 42))).toBe(400);
    expect(await estado(pedirCambios(deps, "j1", "t1", "a".repeat(4001)))).toBe(400);
    expect(guardados).toEqual([]);
  });

  it("el ticket debe existir y estar en Pre-Cierre", async () => {
    expect(await estado(pedirCambios(montar({ ticket: null }).deps, "j1", "t1", "Corrige"))).toBe(404);
    const enCierre = montar({ ticket: ticketEnPreCierre({ estatus: "Cierre" }) });
    expect(await estado(pedirCambios(enCierre.deps, "j1", "t1", "Corrige"))).toBe(409);
    expect(enCierre.guardados).toEqual([]);
  });
});

describe("pedirCambios: resultado", () => {
  it("regresa a Proceso en tramite, borra el visto bueno, crea comentario y entrada en una sola operacion y avisa", async () => {
    const { deps, guardados, avisos } = montar();
    await pedirCambios(deps, "j1", "t1", "  Falta el anexo B  ");
    expect(guardados).toHaveLength(1);
    const op = guardados[0];
    const historial = op.patchTicket.historialEstatus ?? [];
    expect(op.patchTicket.estatus).toBe("Proceso en tramite");
    expect(historial[historial.length - 1]).toEqual({ estatus: "Proceso en tramite", fecha: AHORA.toISOString(), uid: "j1" });
    expect(op.patchResumen).toEqual({ estatus: "Proceso en tramite", vistoBueno: null, actualizadoEn: AHORA.toISOString() });
    expect(op.comentarioId).toBe("c1");
    expect(op.comentario).toEqual({
      autorUid: "j1", autorNombre: "Jefe Uno", autorRol: "jefe_zona", texto: "Falta el anexo B",
      tipo: "cambios_solicitados", creadoEn: AHORA.toISOString(), eliminado: false, avisoEnviado: true,
    });
    expect(op.entrada).toMatchObject({ tipo: "cambios_solicitados", comentarioId: "c1", actorUid: "j1", actorRol: "jefe_zona" });
    expect(op.entrada.cambios.map((c) => c.campo)).toEqual(["estatus", "vistoBueno"]);
    expect(avisos).toEqual(["t1"]);
  });

  it("el SLA del abogado se reanuda: la pausa termina en la fecha del regreso", async () => {
    const { deps, guardados } = montar();
    await pedirCambios(deps, "j1", "t1", "Corrige");
    const historialEstatus = guardados[0].patchTicket.historialEstatus ?? [];
    const pausa = diasHabilesEnPausa({ fechaAsignacion: FECHA_ASIGNACION, historialEstatus }, new Date("2026-10-30T15:00:00.000Z"));
    expect(pausa).toBe(businessDaysBetween(new Date(INICIO_PAUSA), AHORA));
  });

  it("abre la conversacion si el ticket no la tenia", async () => {
    const { deps, guardados } = montar();
    await pedirCambios(deps, "j1", "t1", "Corrige");
    expect(guardados[0].patchTicket.conversacionAbiertaEn).toBe(AHORA.toISOString());
  });

  it("sin resumen no toca resumenesContrato y la entrada solo registra el estatus", async () => {
    const { deps, guardados } = montar({ resumen: null });
    await pedirCambios(deps, "j1", "t1", "Corrige");
    expect(guardados[0].patchResumen).toBeNull();
    expect(guardados[0].entrada.cambios.map((c) => c.campo)).toEqual(["estatus"]);
  });

  it("si el aviso falla, el cambio ya guardado se conserva", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, guardados } = montar({ avisoRoto: true });
    await expect(pedirCambios(deps, "j1", "t1", "Corrige")).resolves.toBeDefined();
    expect(guardados).toHaveLength(1);
  });
});
