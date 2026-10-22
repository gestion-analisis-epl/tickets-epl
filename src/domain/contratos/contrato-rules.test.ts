import { describe, expect, it } from "vitest";
import { accionResumen, construirResumenContrato, documentosDelResumen, encontrarContrato, esPendienteObsoleto, nombreDeUrl, resumenReintentable, resumenSinCambios } from "./contrato-rules";
import { buildTicket } from "@/test/ticket-fixture";
import type { ResumenContratoTicket } from "@/types/resumen-contrato";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/tickets-epl-legal/o/tickets%2Ft1%2F${encodeURIComponent(nombre)}?alt=media&token=abc`;

describe("nombreDeUrl", () => {
  it("devuelve el nombre del archivo sin la ruta ni el prefijo de timestamp", () => {
    expect(nombreDeUrl(url("1700000000_SITIO_CONTRATO_ARRENDAMIENTO_V2.docx"))).toBe("SITIO_CONTRATO_ARRENDAMIENTO_V2.docx");
  });
  it("con una URL invalida devuelve cadena vacia", () => {
    expect(nombreDeUrl("no-es-url")).toBe("");
  });
});

describe("encontrarContrato", () => {
  it("encuentra el docx cuyo nombre contiene CONTRATO_ARRENDAMIENTO", () => {
    const docs = [url("1_predial.pdf"), url("2_QRO01_CONTRATO_ARRENDAMIENTO_FINAL.docx")];
    expect(encontrarContrato(docs)).toBe(docs[1]);
  });
  it("ignora mayusculas y minusculas", () => {
    const docs = [url("3_qro01_contrato_arrendamiento.DOCX")];
    expect(encontrarContrato(docs)).toBe(docs[0]);
  });
  it("acepta pdf, sin importar mayusculas", () => {
    const docs = [url("1_CONTRATO_ARRENDAMIENTO.pdf"), url("2_x_contrato_arrendamiento.PDF")];
    expect(encontrarContrato([docs[1]])).toBe(docs[1]);
    expect(encontrarContrato(docs)).toBe(docs[0]);
  });
  it("con docx y pdf toma el primero en el orden de documentacion", () => {
    const pdf = url("1_CONTRATO_ARRENDAMIENTO.pdf");
    const docx = url("2_CONTRATO_ARRENDAMIENTO.docx");
    expect(encontrarContrato([pdf, docx])).toBe(pdf);
    expect(encontrarContrato([docx, pdf])).toBe(docx);
  });
  it("no toma otras extensiones ni pdf sin el patron", () => {
    expect(encontrarContrato([url("1_CONTRATO_ARRENDAMIENTO.pdf.exe")])).toBeNull();
    expect(encontrarContrato([url("1_CONTRATO_ARRENDAMIENTO.doc")])).toBeNull();
    expect(encontrarContrato([url("1_CONTRATO_ARRENDAMIENTO.txt")])).toBeNull();
    expect(encontrarContrato([url("1_predial.pdf")])).toBeNull();
  });
  it("sin coincidencia devuelve null", () => {
    expect(encontrarContrato([url("1_otro.docx")])).toBeNull();
    expect(encontrarContrato([])).toBeNull();
  });
  it("con varios, toma el primero", () => {
    const docs = [url("1_A_CONTRATO_ARRENDAMIENTO.docx"), url("2_B_CONTRATO_ARRENDAMIENTO.docx")];
    expect(encontrarContrato(docs)).toBe(docs[0]);
  });
});

describe("accionResumen", () => {
  it.each([
    ["Proceso en tramite", "Pre-Cierre", "upsert"],
    ["Validacion y presentacion de requerimiento", "Cierre", "upsert"],
    ["Pre-Cierre", "Cierre", "upsert"],
    ["Cierre", "Pre-Cierre", "upsert"],
    ["Pre-Cierre", "Proceso en tramite", "actualizar-estatus"],
    ["Cierre", "Proceso en tramite", "actualizar-estatus"],
    ["Recepcion de solicitud", "Proceso en tramite", "ninguna"],
  ] as const)("%s -> %s = %s", (previo, nuevo, esperado) => {
    expect(accionResumen(previo, nuevo)).toBe(esperado);
  });
});

describe("construirResumenContrato", () => {
  const ahora = new Date("2026-10-08T12:00:00.000Z");

  it("arma el resumen con los datos del ticket", () => {
    const ticket = buildTicket({
      id: "t9", folio: "JUR-0009", estatus: "Pre-Cierre", solicitanteNombre: "Ana Lopez",
      sitioArrendamiento: { clave: "QRO01", alias: "Queretaro Centro" },
      documentacion: [url("1_QRO01_CONTRATO_ARRENDAMIENTO.docx")],
      contratoArrendamiento: {
        domicilio: "Av. 1 #2", altaArrendador: "Juan SA", solicitante: "Ana Lopez",
        periodoInicio: "2026-01-01", periodoFin: "2027-01-01", condicionesPago: "63 - Cheques", montoPago: 120000, motivo: "Renovacion",
      },
    });
    const r = construirResumenContrato(ticket, ahora);
    expect(r).toMatchObject({
      ticketId: "t9", folio: "JUR-0009", estatus: "Pre-Cierre",
      sitioClave: "QRO01", sitioAlias: "Queretaro Centro", domicilio: "Av. 1 #2",
      solicitante: "Ana Lopez", altaArrendador: "Juan SA", metodoPago: "63 - Cheques",
      periodoInicio: "2026-01-01", periodoFin: "2027-01-01",
      contratoNombre: "QRO01_CONTRATO_ARRENDAMIENTO.docx", estadoResumen: "pendiente",
      vistoBueno: null, actualizadoEn: ahora.toISOString(),
    });
    expect(r.contratoUrl).toBe(ticket.documentacion[0]);
  });

  it("sin contratoArrendamiento deja los campos en null y usa el solicitante del ticket", () => {
    const r = construirResumenContrato(buildTicket({ estatus: "Cierre" }), ahora);
    expect(r.domicilio).toBeNull();
    expect(r.solicitante).toBe("Juan Perez");
    expect(r.contratoUrl).toBeNull();
    expect(r.estadoResumen).toBe("sin_contrato");
  });

  it("conserva el visto bueno previo", () => {
    const previo = construirResumenContrato(buildTicket({ estatus: "Pre-Cierre" }), ahora);
    previo.vistoBueno = { uid: "j1", nombre: "Jefe", fecha: ahora.toISOString() };
    const r = construirResumenContrato(buildTicket({ estatus: "Cierre" }), ahora, previo);
    expect(r.vistoBueno).toEqual(previo.vistoBueno);
    expect(r.estatus).toBe("Cierre");
  });

  it("copia los campos de pago y las discrepancias de ticket.resumenContrato cuando estan listos", () => {
    const ticket = buildTicket({
      estatus: "Pre-Cierre",
      resumenContrato: {
        estado: "listo", contratoNombre: "x.docx", generadoEn: ahora.toISOString(), error: undefined,
        discrepancias: [{ campo: "domicilio", valorTicket: "A", valorContrato: "B" }],
        extraccion: {
          sitio: null, codigo: null, domicilio: "B", altaArrendador: null, solicitante: null,
          periodoInicio: null, periodoFin: null, condicionesPago: "Dia 5", montoPagoAnual: 240000, formaPago: "mensual",
        },
      },
    });
    const r = construirResumenContrato(ticket, ahora);
    expect(r.condicionesPago).toBe("Dia 5");
    expect(r.montoPagoAnual).toBe(240000);
    expect(r.formaPago).toBe("mensual");
    expect(r.discrepancias).toHaveLength(1);
    expect(r.estadoResumen).toBe("listo");
  });

  it("usa la URL con la que se genero el resumen aunque no coincida con el patron", () => {
    const elegido = url("2_otro.docx");
    const ticket = buildTicket({
      estatus: "Pre-Cierre",
      documentacion: [url("1_QRO01_CONTRATO_ARRENDAMIENTO.docx"), elegido],
      resumenContrato: { estado: "listo", extraccion: null, discrepancias: [], contratoNombre: "otro.docx", generadoEn: null, contratoUrl: elegido },
    });
    const r = construirResumenContrato(ticket, ahora);
    expect(r.contratoUrl).toBe(elegido);
    expect(r.contratoNombre).toBe("otro.docx");
  });

  it("ignora una contratoUrl que ya no esta en la documentacion", () => {
    const ticket = buildTicket({
      estatus: "Pre-Cierre",
      documentacion: [url("1_QRO01_CONTRATO_ARRENDAMIENTO.docx")],
      resumenContrato: { estado: "listo", extraccion: null, discrepancias: [], contratoNombre: "x", generadoEn: null, contratoUrl: "https://evil.test/x.docx" },
    });
    expect(construirResumenContrato(ticket, ahora).contratoUrl).toBe(ticket.documentacion[0]);
  });

  it("sin contratoUrl en el resumen de Gemini conserva el contrato encontrado", () => {
    const ticket = buildTicket({
      estatus: "Pre-Cierre",
      documentacion: [url("1_QRO01_CONTRATO_ARRENDAMIENTO.docx")],
      resumenContrato: { estado: "error", extraccion: null, discrepancias: [], contratoNombre: null, generadoEn: null },
    });
    expect(construirResumenContrato(ticket, ahora).contratoUrl).toBe(ticket.documentacion[0]);
  });
});

describe("pendiente obsoleto y reintento", () => {
  const base: Omit<ResumenContratoTicket, "estado"> = { extraccion: null, discrepancias: [], contratoNombre: null, generadoEn: null };
  const ahora = new Date("2026-10-08T12:00:00.000Z");
  const pendiente = (solicitadoEn?: string | null) => ({ ...base, estado: "pendiente" as const, solicitadoEn });

  it("pendiente reciente no es obsoleto; de mas de 5 minutos o sin marca si", () => {
    expect(esPendienteObsoleto(pendiente("2026-10-08T11:57:00.000Z"), ahora)).toBe(false);
    expect(esPendienteObsoleto(pendiente("2026-10-08T11:54:00.000Z"), ahora)).toBe(true);
    expect(esPendienteObsoleto(pendiente(), ahora)).toBe(true);
    expect(esPendienteObsoleto(pendiente(null), ahora)).toBe(true);
    expect(esPendienteObsoleto({ ...base, estado: "listo" }, ahora)).toBe(false);
    expect(esPendienteObsoleto(undefined, ahora)).toBe(false);
  });

  it("es reintentable sin resumen, con error o con pendiente obsoleto", () => {
    expect(resumenReintentable(undefined, ahora)).toBe(true);
    expect(resumenReintentable({ ...base, estado: "error" }, ahora)).toBe(true);
    expect(resumenReintentable(pendiente("2026-10-08T11:00:00.000Z"), ahora)).toBe(true);
    expect(resumenReintentable(pendiente("2026-10-08T11:59:00.000Z"), ahora)).toBe(false);
    expect(resumenReintentable({ ...base, estado: "listo" }, ahora)).toBe(false);
  });
});

describe("documentosDelResumen", () => {
  it("lista formato, documentos de Alta y documentacion, sin repetir ni incluir el contrato aparte", () => {
    const contrato = url("1_CONTRATO_ARRENDAMIENTO.docx");
    const ticket = buildTicket({
      formatoArrendamientoUrl: url("2_formato.docx"),
      documentosArrendamiento: { escrituras: url("3_esc.pdf"), identificacionArrendador: url("4_ine.pdf"), predial: "", comprobanteDomicilio: url("3_esc.pdf") },
      documentacion: [contrato, url("5_extra.pdf")],
    });
    expect(documentosDelResumen(ticket, contrato).map((d) => d.etiqueta)).toEqual([
      "Formato de solicitud de arrendamiento",
      "Escrituras de la propiedad",
      "Identificación oficial del arrendador",
      "extra.pdf",
    ]);
  });

  it("el resumen de un ticket de Alta lleva servicio, motivo y documentos", () => {
    const ticket = buildTicket({ servicioId: "JUR-C071", formatoArrendamientoUrl: url("2_formato.docx") });
    const r = construirResumenContrato(ticket, new Date("2026-10-08T12:00:00.000Z"));
    expect(r.servicioId).toBe("JUR-C071");
    expect(r.documentos).toHaveLength(1);
    expect(r.estadoResumen).toBe("sin_contrato");
  });
});

describe("datos del resumen cuando el ticket no tiene ficha de contrato", () => {
  const ahora = new Date("2026-10-08T12:00:00.000Z");
  const conIA = (contratoArrendamiento?: object) => buildTicket({
    estatus: "Cierre",
    contratoArrendamiento: contratoArrendamiento as never,
    resumenContrato: {
      estado: "listo", contratoNombre: "x.docx", generadoEn: ahora.toISOString(), discrepancias: [],
      extraccion: {
        sitio: null, codigo: null, domicilio: "Av. IA 5", altaArrendador: "Arrendador IA", solicitante: null,
        periodoInicio: "2026-02-01", periodoFin: "2027-02-01", condicionesPago: null, montoPagoAnual: null, formaPago: null,
      },
    },
  });

  it("usa lo que leyo la IA del contrato", () => {
    const r = construirResumenContrato(conIA(), ahora);
    expect(r).toMatchObject({ domicilio: "Av. IA 5", altaArrendador: "Arrendador IA", periodoInicio: "2026-02-01", periodoFin: "2027-02-01" });
  });

  it("lo capturado en la ficha tiene prioridad sobre la IA", () => {
    const r = construirResumenContrato(conIA({
      domicilio: "Av. Ficha 1", altaArrendador: "Ficha SA", solicitante: "Ana", periodoInicio: "2026-01-01", periodoFin: "2027-01-01",
      condicionesPago: "63 - Cheques", montoPago: 1, motivo: "x",
    }), ahora);
    expect(r).toMatchObject({ domicilio: "Av. Ficha 1", altaArrendador: "Ficha SA", periodoInicio: "2026-01-01" });
  });
});

describe("resumenSinCambios", () => {
  const ahora = new Date("2026-10-08T12:00:00.000Z");
  it("ignora la fecha de actualizacion y el orden de las claves", () => {
    const a = construirResumenContrato(buildTicket({ estatus: "Cierre" }), ahora);
    const b = Object.fromEntries(Object.entries({ ...a, actualizadoEn: "otra" }).reverse()) as unknown as typeof a;
    expect(resumenSinCambios(a, b)).toBe(true);
    expect(resumenSinCambios(a, { ...a, domicilio: "otro" })).toBe(false);
  });
});
