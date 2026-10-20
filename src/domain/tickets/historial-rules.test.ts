import { describe, expect, it } from "vitest";
import {
  actorDesdeSesion,
  calcularCambios,
  construirEntrada,
  entradaCambiosSolicitados,
  entradaComentarioEditado,
  entradaComentarioEliminado,
  entradaExclusion,
  entradaSitio,
  entradasAsignacion,
  entradasSolicitud,
  entradaVistoBueno,
  ETIQUETA_TIPO_HISTORIAL,
  lineaDeTiempo,
  puedeVerHistorial,
  textoDeValor,
  textoDocumentos,
  type CampoVigilado,
} from "./historial-rules";
import { TIPOS_HISTORIAL, type ActorHistorial, type EntradaHistorialGuardada } from "@/types/historial";
import { buildTicket } from "@/test/ticket-fixture";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/tickets-epl-legal/o/tickets%2Ft1%2F${encodeURIComponent(nombre)}?alt=media&token=x`;

describe("textoDeValor", () => {
  it("convierte cada tipo de valor a texto legible", () => {
    expect(textoDeValor(null)).toBeNull();
    expect(textoDeValor(undefined)).toBeNull();
    expect(textoDeValor("")).toBeNull();
    expect(textoDeValor("hola")).toBe("hola");
    expect(textoDeValor(5)).toBe("5");
    expect(textoDeValor(true)).toBe("sí");
    expect(textoDeValor(false)).toBe("no");
    expect(textoDeValor(["a", "b"])).toBe("a, b");
    expect(textoDeValor([])).toBeNull();
    expect(textoDeValor({ clave: "K1", alias: "Sitio Uno" })).toBe("K1 — Sitio Uno");
  });
});

describe("textoDocumentos", () => {
  it("lista los documentos por nombre de archivo, no por URL", () => {
    expect(textoDocumentos([url("1700_contrato.docx"), url("1800_predial.pdf")])).toBe("contrato.docx, predial.pdf");
  });

  it("sin documentos devuelve null", () => {
    expect(textoDocumentos([])).toBeNull();
    expect(textoDocumentos(undefined)).toBeNull();
  });

  it("una URL invalida no se copia al historial", () => {
    expect(textoDocumentos(["no-es-url"])).toBe("archivo sin nombre");
  });
});

describe("calcularCambios", () => {
  const campos: CampoVigilado[] = [
    { campo: "descripcion", etiqueta: "Descripción" },
    { campo: "slaInterno", etiqueta: "SLA interno" },
    { campo: "documentacion", etiqueta: "Documentación", formato: textoDocumentos },
  ];

  it("solo registra los campos vigilados que cambian", () => {
    const antes = buildTicket({ descripcion: "vieja", slaInterno: 5 });
    expect(calcularCambios(antes, { descripcion: "nueva", slaInterno: 5, areaEmpresa: "Otra" }, campos)).toEqual([
      { campo: "descripcion", etiqueta: "Descripción", antes: "vieja", despues: "nueva" },
    ]);
  });

  it("ignora los campos vigilados que no vienen en el cambio", () => {
    expect(calcularCambios(buildTicket(), {}, campos)).toEqual([]);
  });

  it("usa el formato propio del campo", () => {
    const antes = buildTicket({ documentacion: [url("1_a.pdf")] });
    expect(calcularCambios(antes, { documentacion: [url("1_a.pdf"), url("2_b.pdf")] }, campos)).toEqual([
      { campo: "documentacion", etiqueta: "Documentación", antes: "a.pdf", despues: "a.pdf, b.pdf" },
    ]);
  });

  it("pasar de texto vacio a null no cuenta como cambio", () => {
    expect(calcularCambios(buildTicket({ notasCierre: "" }), { notasCierre: null }, [{ campo: "notasCierre", etiqueta: "Notas" }])).toEqual([]);
  });
});

const actor: ActorHistorial = { uid: "u1", nombre: "Ana", rol: "admin" };
const AHORA = new Date("2026-10-09T15:00:00.000Z");
const ISO = AHORA.toISOString();

describe("construirEntrada", () => {
  it("sin cambios no crea entrada", () => {
    expect(construirEntrada("estatus", actor, AHORA, [])).toBeNull();
  });

  it("lleva fecha, actor y tipo; comentarioId solo si se da", () => {
    const cambios = [{ campo: "x", etiqueta: "X", antes: null, despues: "1" }];
    const entrada = construirEntrada("sitio", actor, AHORA, cambios);
    expect(entrada).toEqual({ fecha: ISO, actorUid: "u1", actorNombre: "Ana", actorRol: "admin", tipo: "sitio", cambios });
    expect(entrada !== null && "comentarioId" in entrada).toBe(false);
    expect(construirEntrada("comentario_editado", actor, AHORA, cambios, "c1")?.comentarioId).toBe("c1");
  });
});

describe("entradasAsignacion", () => {
  it("separa estatus, asignacion y notas de cierre", () => {
    const antes = buildTicket({ estatus: "Recepcion de solicitud" });
    const patch = {
      estatus: "Proceso en tramite" as const,
      abogadoAsignadoId: "Karina Valenzuela - Abogado Corporativo",
      notasCierre: "ok",
      fechaAsignacion: ISO,
    };
    const entradas = entradasAsignacion(antes, patch, actor, AHORA);
    expect(entradas.map((e) => e.tipo)).toEqual(["estatus", "asignacion", "notas_cierre"]);
    expect(entradas[1].cambios[0]).toEqual({ campo: "abogadoAsignadoId", etiqueta: "Abogado asignado", antes: null, despues: "Karina Valenzuela" });
  });

  it("sin cambios efectivos no devuelve entradas (historialEstatus no se vigila)", () => {
    const antes = buildTicket();
    const patch = { estatus: antes.estatus, abogadoAsignadoId: null, notasCierre: null, historialEstatus: antes.historialEstatus };
    expect(entradasAsignacion(antes, patch, actor, AHORA)).toEqual([]);
  });

  it("el cierre registra tambien la fecha de cierre dentro de la entrada de estatus", () => {
    const antes = buildTicket({ estatus: "Pre-Cierre" });
    const [estatus] = entradasAsignacion(antes, { estatus: "Cierre", fechaCierre: ISO }, actor, AHORA);
    expect(estatus.cambios.map((c) => c.campo)).toEqual(["estatus", "fechaCierre"]);
  });
});

describe("entradasSolicitud", () => {
  it("separa la edicion de los documentos e incluye derivados solo si cambian", () => {
    const antes = buildTicket({ servicioId: "S1", slaInterno: 5, documentacion: [] });
    const patch = { servicioId: "S2", slaInterno: 3, categoria: antes.categoria, documentacion: [url("1_contrato.docx")] };
    const entradas = entradasSolicitud(antes, patch, actor, AHORA, (id) => `Servicio ${id}`);
    expect(entradas.map((e) => e.tipo)).toEqual(["solicitud", "documentos"]);
    expect(entradas[0].cambios).toEqual([
      { campo: "servicioId", etiqueta: "Servicio", antes: "Servicio S1", despues: "Servicio S2" },
      { campo: "slaInterno", etiqueta: "SLA interno", antes: "5", despues: "3" },
    ]);
    expect(entradas[1].cambios).toEqual([{ campo: "documentacion", etiqueta: "Documentación", antes: null, despues: "contrato.docx" }]);
  });
});

describe("entradaSitio y entradaExclusion", () => {
  it("el sitio se registra como clave — alias y no se repite si no cambia", () => {
    const patch = { sitioArrendamiento: { clave: "K1", alias: "Uno" } };
    expect(entradaSitio(buildTicket(), patch, actor, AHORA)?.cambios).toEqual([
      { campo: "sitioArrendamiento", etiqueta: "Sitio", antes: null, despues: "K1 — Uno" },
    ]);
    expect(entradaSitio(buildTicket(patch), patch, actor, AHORA)).toBeNull();
  });

  it("la exclusion se registra como si/no; un ticket sin el campo cuenta como no", () => {
    expect(entradaExclusion(buildTicket(), true, actor, AHORA)?.cambios).toEqual([
      { campo: "excluidoDelPipeline", etiqueta: "Excluido de la gestión", antes: "no", despues: "sí" },
    ]);
    expect(entradaExclusion(buildTicket(), false, actor, AHORA)).toBeNull();
  });
});

describe("entradas sin ticket: visto bueno, cambios solicitados y comentarios", () => {
  const visto = { uid: "j1", nombre: "Jefe Uno", fecha: "2026-10-08T10:00:00.000Z" };

  it("visto bueno", () => {
    expect(entradaVistoBueno(actor, AHORA, visto)).toEqual({
      fecha: ISO, actorUid: "u1", actorNombre: "Ana", actorRol: "admin", tipo: "visto_bueno",
      cambios: [{ campo: "vistoBueno", etiqueta: "Visto bueno", antes: null, despues: "Jefe Uno (2026-10-08T10:00:00.000Z)" }],
    });
  });

  it("cambios solicitados registra el regreso de estatus y el visto bueno borrado", () => {
    const entrada = entradaCambiosSolicitados(actor, AHORA, {
      estatusAntes: "Pre-Cierre", estatusDespues: "Proceso en tramite", vistoBuenoAntes: visto, comentarioId: "c9",
    });
    expect(entrada.tipo).toBe("cambios_solicitados");
    expect(entrada.comentarioId).toBe("c9");
    expect(entrada.cambios).toEqual([
      { campo: "estatus", etiqueta: "Estatus", antes: "Pre-Cierre", despues: "Proceso en tramite" },
      { campo: "vistoBueno", etiqueta: "Visto bueno", antes: "Jefe Uno (2026-10-08T10:00:00.000Z)", despues: null },
    ]);
  });

  it("cambios solicitados sin visto bueno previo solo registra el estatus", () => {
    const entrada = entradaCambiosSolicitados(actor, AHORA, {
      estatusAntes: "Pre-Cierre", estatusDespues: "Proceso en tramite", vistoBuenoAntes: null, comentarioId: "c9",
    });
    expect(entrada.cambios.map((c) => c.campo)).toEqual(["estatus"]);
  });

  it("editar y borrar un comentario guardan el texto anterior", () => {
    expect(entradaComentarioEditado(actor, AHORA, "c1", "antes", "despues")).toMatchObject({
      tipo: "comentario_editado", comentarioId: "c1",
      cambios: [{ campo: "texto", etiqueta: "Comentario", antes: "antes", despues: "despues" }],
    });
    expect(entradaComentarioEliminado(actor, AHORA, "c1", "antes")).toMatchObject({
      tipo: "comentario_eliminado", comentarioId: "c1",
      cambios: [{ campo: "texto", etiqueta: "Comentario", antes: "antes", despues: null }],
    });
  });
});

describe("actorDesdeSesion y etiquetas", () => {
  it("sin uid no hay actor; sin nombre usa cadena vacia", () => {
    expect(actorDesdeSesion({ uid: null, nombre: "X", role: "admin" })).toBeNull();
    expect(actorDesdeSesion({ uid: "u1", nombre: null, role: "abogado" })).toEqual({ uid: "u1", nombre: "", rol: "abogado", abogadoId: null });
  });

  it("todos los tipos tienen etiqueta", () => {
    for (const tipo of TIPOS_HISTORIAL) expect(ETIQUETA_TIPO_HISTORIAL[tipo]).toBeTruthy();
  });
});

describe("lineaDeTiempo", () => {
  const entrada = (id: string, fecha: string): EntradaHistorialGuardada => ({
    id, fecha, actorUid: "u1", actorNombre: "Ana", actorRol: "admin", tipo: "estatus", cambios: [],
  });

  it("entradas en orden descendente y, al final, el historial de estatus previo al despliegue", () => {
    const items = lineaDeTiempo(
      [entrada("a", "2026-10-09T10:00:00.000Z"), entrada("b", "2026-10-10T10:00:00.000Z")],
      [
        { estatus: "Asignacion de responsable", fecha: "2026-10-01T10:00:00.000Z", uid: "x" },
        { estatus: "Proceso en tramite", fecha: "2026-10-02T10:00:00.000Z", uid: "x" },
        { estatus: "Pre-Cierre", fecha: "2026-10-09T10:00:00.000Z", uid: "x" },
      ]
    );
    expect(items.map((i) => (i.origen === "historial" ? i.entrada.id : i.estatus))).toEqual([
      "b", "a", "Proceso en tramite", "Asignacion de responsable",
    ]);
  });

  it("sin entradas muestra todo el historial de estatus", () => {
    const items = lineaDeTiempo([], [{ estatus: "Cierre", fecha: "2026-10-01T10:00:00.000Z", uid: "x" }]);
    expect(items).toEqual([{ origen: "estatus", fecha: "2026-10-01T10:00:00.000Z", estatus: "Cierre" }]);
  });
});

describe("puedeVerHistorial", () => {
  const ticket = { abogadoAsignadoId: "Karina Valenzuela - Abogado Corporativo" };

  it("admin y gerente juridico siempre", () => {
    expect(puedeVerHistorial({ role: "admin", abogadoId: null }, ticket)).toBe(true);
    expect(puedeVerHistorial({ role: "gerente_juridico", abogadoId: null }, ticket)).toBe(true);
  });

  it("el abogado asignado si; otro abogado no", () => {
    expect(puedeVerHistorial({ role: "abogado", abogadoId: "Karina Valenzuela - Abogado Corporativo" }, ticket)).toBe(true);
    expect(puedeVerHistorial({ role: "abogado", abogadoId: "Jessica Valadez - Abogado Comercial" }, ticket)).toBe(false);
  });

  it("mesa de control, solicitante y jefe de zona no", () => {
    expect(puedeVerHistorial({ role: "mesa_control", abogadoId: null }, ticket)).toBe(false);
    expect(puedeVerHistorial({ role: "solicitante", abogadoId: null }, ticket)).toBe(false);
    expect(puedeVerHistorial({ role: "jefe_zona", abogadoId: null }, ticket)).toBe(false);
  });

  it("sin abogado asignado nadie entra por esa via", () => {
    expect(puedeVerHistorial({ role: "abogado", abogadoId: null }, { abogadoAsignadoId: null })).toBe(false);
  });
});
