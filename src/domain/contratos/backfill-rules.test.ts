import { describe, expect, it } from "vitest";
import { archivoPorDefecto, docxsDeDocumentacion, ticketsPendientesDeResumen } from "./backfill-rules";
import { buildTicket } from "@/test/ticket-fixture";
import type { ResumenContratoTicket } from "@/types/resumen-contrato";

const url = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/tickets-epl-legal/o/tickets%2Ft1%2F${encodeURIComponent(nombre)}?alt=media&token=abc`;

const contrato = url("1_QRO01_CONTRATO_ARRENDAMIENTO.docx");
const otroDocx = url("2_anexo.docx");
const pdf = url("3_predial.pdf");

const resumen: ResumenContratoTicket = {
  estado: "listo",
  extraccion: null,
  discrepancias: [],
  contratoNombre: null,
  generadoEn: null,
};

describe("docxsDeDocumentacion", () => {
  it("deja solo los .docx", () => {
    expect(docxsDeDocumentacion([pdf, contrato, otroDocx])).toEqual([contrato, otroDocx]);
  });
});

describe("archivoPorDefecto", () => {
  it("prefiere el contrato detectado por nombre", () => {
    expect(archivoPorDefecto(buildTicket({ documentacion: [otroDocx, contrato] }))).toBe(contrato);
  });
  it("prefiere el archivo ya usado en el resumen", () => {
    const t = buildTicket({ documentacion: [contrato, otroDocx], resumenContrato: { ...resumen, contratoUrl: otroDocx } });
    expect(archivoPorDefecto(t)).toBe(otroDocx);
  });
  it("sin contrato por nombre usa el primer docx", () => {
    expect(archivoPorDefecto(buildTicket({ documentacion: [pdf, otroDocx] }))).toBe(otroDocx);
  });
  it("sin docx devuelve cadena vacia", () => {
    expect(archivoPorDefecto(buildTicket({ documentacion: [pdf] }))).toBe("");
  });
});

describe("ticketsPendientesDeResumen", () => {
  it("lista solo tickets sin resumen y con contrato", () => {
    const a = buildTicket({ id: "a", documentacion: [contrato] });
    const b = buildTicket({ id: "b", documentacion: [contrato], resumenContrato: resumen });
    const c = buildTicket({ id: "c", documentacion: [pdf] });
    expect(ticketsPendientesDeResumen([a, b, c]).map((t) => t.id)).toEqual(["a"]);
  });
});
