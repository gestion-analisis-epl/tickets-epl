import { describe, expect, it } from "vitest";
import type { TipoNotificacion } from "./notificacion";
import { ACENTO_POR_TIPO, formatearFecha, renderEmailNotificacion, type DatosEmailNotificacion } from "./email-template";

const TIPOS: TipoNotificacion[] = [
  "nuevo_ticket",
  "asignacion",
  "cambio_estatus",
  "cierre",
  "creacion_solicitante",
  "asignacion_solicitante",
  "reasignacion",
  "reasignacion_solicitante",
];

function datos(over: Partial<DatosEmailNotificacion> = {}): DatosEmailNotificacion {
  return {
    tipo: "nuevo_ticket",
    mensaje: "Se creo una nueva solicitud.",
    folio: "JUR-0042",
    verTicketUrl: "https://app.test/tickets/abc",
    calificarUrl: null,
    logoUrl: "https://logo.test/grupo-epl.png",
    ticket: {},
    ...over,
  };
}

describe("formatearFecha", () => {
  it("formatea una fecha ISO en espanol", () => {
    expect(formatearFecha("2026-09-30T18:00:00.000Z")).toBe("30 sep 2026");
  });

  it("devuelve undefined si la fecha falta o es invalida", () => {
    expect(formatearFecha(null)).toBeUndefined();
    expect(formatearFecha(undefined)).toBeUndefined();
    expect(formatearFecha("no-es-fecha")).toBeUndefined();
  });
});

describe("renderEmailNotificacion", () => {
  it.each(TIPOS)("%s incluye mensaje, folio, etiqueta y boton Ver ticket", (tipo) => {
    const html = renderEmailNotificacion(datos({ tipo }));
    expect(html).toContain("Se creo una nueva solicitud.");
    expect(html).toContain("JUR-0042");
    expect(html).toContain('href="https://app.test/tickets/abc"');
    expect(html).toContain("Ver ticket");
    expect(html).toContain(ACENTO_POR_TIPO[tipo]);
  });

  it("todos los tipos tienen acento definido", () => {
    for (const tipo of TIPOS) expect(ACENTO_POR_TIPO[tipo]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("el cierre usa verde y las reasignaciones ambar", () => {
    expect(ACENTO_POR_TIPO.cierre).not.toBe(ACENTO_POR_TIPO.nuevo_ticket);
    expect(ACENTO_POR_TIPO.reasignacion).toBe(ACENTO_POR_TIPO.reasignacion_solicitante);
    expect(ACENTO_POR_TIPO.reasignacion).not.toBe(ACENTO_POR_TIPO.asignacion);
  });

  it("muestra el logo con su alt", () => {
    const html = renderEmailNotificacion(datos());
    expect(html).toContain('src="https://logo.test/grupo-epl.png"');
    expect(html).toContain('alt="Grupo EPL"');
  });

  it("sin logoUrl no pinta <img> y deja el texto de respaldo", () => {
    const html = renderEmailNotificacion(datos({ logoUrl: undefined }));
    expect(html).not.toContain("<img");
    expect(html).toContain("grupo epl");
  });

  it("incluye el boton Calificar solo si hay calificarUrl", () => {
    expect(renderEmailNotificacion(datos())).not.toContain("Calificar tu experiencia");
    const html = renderEmailNotificacion(datos({ tipo: "cierre", calificarUrl: "https://app.test/calificar/abc?token=t" }));
    expect(html).toContain("Calificar tu experiencia");
    expect(html).toContain('href="https://app.test/calificar/abc?token=t"');
  });

  it("muestra solo los datos del ticket que vienen informados", () => {
    const html = renderEmailNotificacion(
      datos({ tipo: "asignacion", ticket: { servicio: "Contratos", abogado: "Ana Perez", sitio: "" } })
    );
    expect(html).toContain("Servicio");
    expect(html).toContain("Contratos");
    expect(html).toContain("Abogado");
    expect(html).toContain("Ana Perez");
    expect(html).not.toContain("Sitio");
    expect(html).not.toContain("Categoria");
  });

  it("sin datos de ticket no pinta la tarjeta", () => {
    expect(renderEmailNotificacion(datos({ ticket: {} }))).not.toContain("Datos del ticket");
  });

  it("cada tipo muestra los campos que le corresponden", () => {
    const completo = {
      solicitante: "Luis", servicio: "S", categoria: "C", sitio: "Sitio X", estatus: "Cierre",
      abogado: "Ana", fechaSolicitud: "1 ene 2026", fechaCompromiso: "5 ene 2026", fechaCierre: "4 ene 2026",
    };
    const cierre = renderEmailNotificacion(datos({ tipo: "cierre", ticket: completo }));
    expect(cierre).toContain("Fecha de cierre");
    expect(cierre).not.toContain("Fecha compromiso");

    const asignacion = renderEmailNotificacion(datos({ tipo: "asignacion", ticket: completo }));
    expect(asignacion).toContain("Fecha compromiso");
    expect(asignacion).not.toContain("Fecha de cierre");

    const nuevo = renderEmailNotificacion(datos({ tipo: "nuevo_ticket", ticket: completo }));
    expect(nuevo).toContain("Solicitante");
    expect(nuevo).not.toContain("Abogado");
  });

  it("escapa HTML en mensaje y datos del ticket", () => {
    const html = renderEmailNotificacion(
      datos({ mensaje: "<script>alert(1)</script>", ticket: { servicio: '"><img src=x>' } })
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"><img src=x>');
    expect(html).toContain("&lt;script&gt;");
  });

  it("incluye el pie de correo automatico", () => {
    expect(renderEmailNotificacion(datos())).toContain("no respondas");
  });
});
