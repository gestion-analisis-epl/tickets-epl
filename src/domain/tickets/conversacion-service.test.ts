import { describe, expect, it } from "vitest";
import { ComentarioInvalidoError, createConversacionService } from "./conversacion-service";
import type { AvisosConversacion, CambioComentario, ComentarioRepository } from "./comentario-repository";
import type { Comentario, NuevoComentario } from "@/types/comentario";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const autor: ActorHistorial = { uid: "u1", nombre: "Sol", rol: "solicitante" };

interface Lote {
  comentarioId: string;
  cambio: CambioComentario;
  entrada: EntradaHistorial;
}

function montar(opts: { avisoRoto?: boolean } = {}) {
  const creados: NuevoComentario[] = [];
  const lotes: Lote[] = [];
  const avisos: string[] = [];
  const repo: Pick<ComentarioRepository, "crear" | "actualizarConHistorial"> = {
    crear: async (_ticketId, comentario) => {
      creados.push(comentario);
      return `c${creados.length}`;
    },
    actualizarConHistorial: async (_ticketId, comentarioId, cambio, entrada) => {
      lotes.push({ comentarioId, cambio, entrada });
    },
  };
  const notificador: AvisosConversacion = {
    comentarioCreado: async (_ticketId, comentarioId) => {
      if (opts.avisoRoto) throw new Error("red");
      avisos.push(comentarioId);
    },
  };
  const service = createConversacionService(repo as unknown as ComentarioRepository, notificador, () => AHORA);
  return { service, creados, lotes, avisos };
}

const comentario = (over: Partial<Comentario> = {}): Comentario => ({
  id: "c1", autorUid: "u1", autorNombre: "Sol", autorRol: "solicitante", texto: "texto original",
  tipo: "comentario", creadoEn: "2026-10-09T10:00:00.000Z", eliminado: false, ...over,
});

describe("comentar", () => {
  it("guarda el texto recortado como comentario vivo y avisa con su id", async () => {
    const { service, creados, avisos } = montar();
    await service.comentar("t1", autor, "  Falta el anexo  ");
    expect(creados).toEqual([{
      autorUid: "u1", autorNombre: "Sol", autorRol: "solicitante", texto: "Falta el anexo",
      tipo: "comentario", creadoEn: AHORA.toISOString(), eliminado: false,
    }]);
    expect(avisos).toEqual(["c1"]);
  });

  it("rechaza texto vacio o de mas de 4000 caracteres sin guardar", async () => {
    const { service, creados } = montar();
    await expect(service.comentar("t1", autor, "   ")).rejects.toBeInstanceOf(ComentarioInvalidoError);
    await expect(service.comentar("t1", autor, "a".repeat(4001))).rejects.toBeInstanceOf(ComentarioInvalidoError);
    expect(creados).toEqual([]);
  });

  it("si el aviso falla, el comentario ya guardado se conserva", async () => {
    const { service, creados } = montar({ avisoRoto: true });
    await expect(service.comentar("t1", autor, "hola")).resolves.toBeUndefined();
    expect(creados).toHaveLength(1);
  });
});

describe("editar y eliminar", () => {
  it("editar escribe comentario y entrada de historial con el texto anterior en un solo lote", async () => {
    const { service, lotes } = montar();
    await service.editar("t1", autor, comentario(), "texto nuevo");
    expect(lotes).toHaveLength(1);
    expect(lotes[0].comentarioId).toBe("c1");
    expect(lotes[0].cambio).toEqual({ texto: "texto nuevo", editadoEn: AHORA.toISOString() });
    expect(lotes[0].entrada).toMatchObject({
      tipo: "comentario_editado", comentarioId: "c1", actorUid: "u1",
      cambios: [{ campo: "texto", etiqueta: "Comentario", antes: "texto original", despues: "texto nuevo" }],
    });
  });

  it("editar sin cambios no escribe nada", async () => {
    const { service, lotes } = montar();
    await service.editar("t1", autor, comentario(), "  texto original ");
    expect(lotes).toEqual([]);
  });

  it("eliminar es logico: texto null, eliminado true, y el historial guarda el texto anterior", async () => {
    const { service, lotes } = montar();
    await service.eliminar("t1", autor, comentario());
    expect(lotes[0].cambio).toEqual({ texto: null, eliminado: true });
    expect(lotes[0].entrada).toMatchObject({
      tipo: "comentario_eliminado", comentarioId: "c1",
      cambios: [{ campo: "texto", etiqueta: "Comentario", antes: "texto original", despues: null }],
    });
  });

  it("nadie edita ni borra comentarios ajenos, eliminados o de cambios solicitados", async () => {
    const { service, lotes } = montar();
    await expect(service.editar("t1", autor, comentario({ autorUid: "otro" }), "x")).rejects.toBeInstanceOf(ComentarioInvalidoError);
    await expect(service.eliminar("t1", autor, comentario({ eliminado: true, texto: null }))).rejects.toBeInstanceOf(ComentarioInvalidoError);
    await expect(service.editar("t1", autor, comentario({ tipo: "cambios_solicitados" }), "x")).rejects.toBeInstanceOf(ComentarioInvalidoError);
    expect(lotes).toEqual([]);
  });
});
