import { describe, expect, it } from "vitest";
import {
  autorDeArchivo,
  CAMPOS_DOCUMENTO_REVISION,
  entradaArchivo,
  registroArchivo,
  registrosDeCreacion,
  registrosPorCambioDeSlots,
  registrosPorCambioDeUrls,
} from "./archivo-rules";
import { esTipoDeProceso, type ActorHistorial } from "@/types/historial";
import type { RegistroArchivoGuardado } from "@/types/archivo";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/b/o/tickets%2Ft1%2F123_${nombre}?alt=media&token=x`;
const ahora = new Date("2026-11-20T16:00:00.000Z");
const ana: ActorHistorial = { uid: "u1", nombre: "Ana", rol: "solicitante" };
const luis: ActorHistorial = { uid: "u2", nombre: "Luis", rol: "gerente_juridico" };

const guardado = (r: Partial<RegistroArchivoGuardado> = {}): RegistroArchivoGuardado => ({
  id: "r1",
  nombre: "A.pdf",
  ruta: "tickets/t1/123_A.pdf",
  origen: "documentacion",
  accion: "subido",
  fecha: "2026-11-20T10:00:00.000Z",
  actorUid: "u1",
  actorNombre: "Ana",
  actorRol: "solicitante",
  ...r,
});

describe("registroArchivo", () => {
  it("toma ruta y nombre de la URL y guarda al actor y la fecha", () => {
    expect(registroArchivo("subido", { url: url("Predial.pdf") }, "documentacion", ana, ahora)).toEqual({
      nombre: "Predial.pdf",
      ruta: "tickets/t1/123_Predial.pdf",
      origen: "documentacion",
      accion: "subido",
      fecha: "2026-11-20T16:00:00.000Z",
      actorUid: "u1",
      actorNombre: "Ana",
      actorRol: "solicitante",
    });
  });

  it("incluye el campo solo cuando se indica", () => {
    const r = registroArchivo("subido", { url: url("A.pdf") }, "alta", ana, ahora, "predial");
    expect(r?.campo).toBe("predial");
    expect("campo" in registroArchivo("subido", { url: url("A.pdf") }, "alta", ana, ahora)!).toBe(false);
  });

  it("prefiere la ruta y el nombre que ya se conocen (archivos recién subidos)", () => {
    const r = registroArchivo("subido", { ruta: "tickets-drafts/d1/9_IMG.jpeg", nombre: "IMG 1.jpeg" }, "documentacion", ana, ahora);
    expect(r).toMatchObject({ ruta: "tickets-drafts/d1/9_IMG.jpeg", nombre: "IMG 1.jpeg" });
  });

  it("devuelve null si la URL no es de Storage", () => {
    expect(registroArchivo("subido", { url: "https://otro.test/x.pdf" }, "documentacion", ana, ahora)).toBeNull();
  });
});

describe("entradaArchivo", () => {
  it("una subida es una entrada archivo_subido del actor, visible para el solicitante", () => {
    const registro = registroArchivo("subido", { url: url("Predial.pdf") }, "documentacion", luis, ahora)!;
    expect(entradaArchivo(registro)).toEqual({
      fecha: "2026-11-20T16:00:00.000Z",
      actorUid: "u2",
      actorNombre: "Luis",
      actorRol: "gerente_juridico",
      tipo: "archivo_subido",
      cambios: [{ campo: "archivo", etiqueta: "Documentación", antes: null, despues: "Predial.pdf" }],
      visibleSolicitante: true,
    });
  });

  it("un borrado es una entrada archivo_eliminado con el nombre en 'antes'", () => {
    const registro = registroArchivo("eliminado", { url: url("Predial.pdf") }, "alta", ana, ahora, "predial")!;
    const entrada = entradaArchivo(registro);
    expect(entrada.tipo).toBe("archivo_eliminado");
    expect(entrada.cambios).toEqual([
      { campo: "archivo", etiqueta: "Documento de alta de arrendador", antes: "Predial.pdf", despues: null },
    ]);
  });

  it("los dos tipos son cambios de proceso", () => {
    expect(esTipoDeProceso("archivo_subido")).toBe(true);
    expect(esTipoDeProceso("archivo_eliminado")).toBe(true);
  });
});

describe("registrosPorCambioDeUrls", () => {
  it("registra los archivos nuevos como subidos y los que faltan como eliminados", () => {
    const registros = registrosPorCambioDeUrls([url("A.pdf"), url("B.pdf")], [url("B.pdf"), url("C.pdf")], "documentacion", luis, ahora);
    expect(registros.map((r) => `${r.accion}:${r.nombre}:${r.actorRol}`)).toEqual([
      "subido:C.pdf:gerente_juridico",
      "eliminado:A.pdf:gerente_juridico",
    ]);
  });

  it("sin cambios no registra nada", () => {
    expect(registrosPorCambioDeUrls([url("A.pdf")], [url("A.pdf")], "documentacion", luis, ahora)).toEqual([]);
  });
});

describe("registrosPorCambioDeSlots", () => {
  it("reemplazar un documento registra su subida y el borrado del anterior, cada uno con su campo", () => {
    const antes = { documentoPropiedad: url("A.pdf"), nombrePropietario: "x" };
    const despues = { documentoPropiedad: url("B.pdf"), cartaAutorizacion: url("C.pdf") };
    const registros = registrosPorCambioDeSlots(antes, despues, CAMPOS_DOCUMENTO_REVISION, "revision_legal", luis, ahora);
    expect(registros.map((r) => `${r.accion}:${r.campo}:${r.nombre}`)).toEqual([
      "subido:documentoPropiedad:B.pdf",
      "eliminado:documentoPropiedad:A.pdf",
      "subido:cartaAutorizacion:C.pdf",
    ]);
  });

  it("un documento que no cambia no genera registro", () => {
    const igual = { documentoPropiedad: url("A.pdf") };
    expect(registrosPorCambioDeSlots(igual, igual, CAMPOS_DOCUMENTO_REVISION, "revision_legal", luis, ahora)).toEqual([]);
  });

  it("acepta que antes no exista", () => {
    const registros = registrosPorCambioDeSlots(undefined, { documentoPropiedad: url("A.pdf") }, CAMPOS_DOCUMENTO_REVISION, "revision_legal", luis, ahora);
    expect(registros).toHaveLength(1);
  });
});

describe("registrosDeCreacion", () => {
  it("solo registra los archivos terminados de subir, con su origen y campo", () => {
    const registros = registrosDeCreacion(
      [
        {
          origen: "documentacion",
          archivos: [
            { name: "a.pdf", path: "tickets-drafts/d/1_a.pdf", status: "done" },
            { name: "b.pdf", path: "tickets-drafts/d/2_b.pdf", status: "error" },
            { name: "c.pdf", status: "done" },
          ],
        },
        { origen: "alta", campo: "predial", archivos: [{ name: "p.pdf", path: "tickets-drafts/d/3_p.pdf", status: "done" }] },
      ],
      ana,
      ahora
    );
    expect(registros.map((r) => `${r.origen}:${r.campo ?? "-"}:${r.nombre}:${r.ruta}`)).toEqual([
      "documentacion:-:a.pdf:tickets-drafts/d/1_a.pdf",
      "alta:predial:p.pdf:tickets-drafts/d/3_p.pdf",
    ]);
    expect(registros.every((r) => r.accion === "subido" && r.actorUid === "u1")).toBe(true);
  });
});

describe("autorDeArchivo", () => {
  it("gana el registro más antiguo por creadoEn", () => {
    const registros = [
      guardado({ id: "nuevo", creadoEn: { toMillis: () => 2000 }, actorNombre: "Luis" }),
      guardado({ id: "viejo", creadoEn: { toMillis: () => 1000 } }),
    ];
    expect(autorDeArchivo(registros, url("A.pdf"))?.id).toBe("viejo");
  });

  it("un registro posterior con fecha del año 9999 no gana", () => {
    const registros = [
      guardado({ id: "primero", creadoEn: { toMillis: () => 1000 } }),
      guardado({ id: "falso", creadoEn: { toMillis: () => 2000 }, fecha: "9999-01-01T00:00:00.000Z" }),
    ];
    expect(autorDeArchivo(registros, url("A.pdf"))?.id).toBe("primero");
  });

  it("un registro con fecha muy antigua pero creadoEn posterior no gana", () => {
    const registros = [
      guardado({ id: "primero", creadoEn: { toMillis: () => 5000 } }),
      guardado({ id: "falso", creadoEn: { toMillis: () => 9000 }, fecha: "1990-01-01T00:00:00.000Z" }),
    ];
    expect(autorDeArchivo(registros, url("A.pdf"))?.id).toBe("primero");
  });

  it("sin creadoEn usa la fecha como respaldo", () => {
    const registros = [
      guardado({ id: "nuevo", fecha: "2026-11-05T10:00:00.000Z" }),
      guardado({ id: "viejo", fecha: "2026-11-01T10:00:00.000Z" }),
    ];
    expect(autorDeArchivo(registros, url("A.pdf"))?.id).toBe("viejo");
  });

  it("ignora los borrados y las rutas de otros archivos", () => {
    const registros = [guardado({ accion: "eliminado" }), guardado({ ruta: "tickets/t1/123_B.pdf" })];
    expect(autorDeArchivo(registros, url("A.pdf"))).toBeNull();
  });

  it("sin registros (ticket anterior) devuelve null", () => {
    expect(autorDeArchivo([], url("A.pdf"))).toBeNull();
  });

  it("una URL que no es de Storage devuelve null", () => {
    expect(autorDeArchivo([guardado()], "https://otro.test/A.pdf")).toBeNull();
  });
});
