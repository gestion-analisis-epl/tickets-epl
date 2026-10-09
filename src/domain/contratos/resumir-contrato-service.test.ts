import { describe, expect, it } from "vitest";
import { generarResumenContrato, puedeGenerarResumen, type DepsResumen } from "./resumir-contrato-service";
import { buildTicket } from "@/test/ticket-fixture";
import type { ResumenContratoTicket } from "@/types/resumen-contrato";
import type { Ticket } from "@/types/ticket";

const url = (n: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/tickets%2Ft1%2F${encodeURIComponent(n)}?alt=media&token=t`;
const CONTRATO = url("1_QRO01_CONTRATO_ARRENDAMIENTO.docx");
const respuestaOk = JSON.stringify({
  sitio: "S", codigo: "QRO01", domicilio: "Calle Reforma 55 Leon", altaArrendador: null, solicitante: null,
  periodoInicio: "2026-01-01", periodoFin: "2027-01-01", condicionesPago: "Dia 5", montoPagoAnual: 1200, formaPago: "mensual",
});
const TEXTO = "contrato ".repeat(20);

function montar(over: Partial<DepsResumen> = {}, ticket: Ticket | null = buildTicket({
  id: "t1", documentacion: [CONTRATO],
  contratoArrendamiento: { domicilio: "Av. Constituyentes 100 Queretaro", altaArrendador: "x", solicitante: "y", periodoInicio: "2026-01-01", periodoFin: "2027-01-01", condicionesPago: "c", montoPago: 1, motivo: "m" },
})) {
  const guardados: ResumenContratoTicket[] = [];
  const deps: DepsResumen = {
    cargarTicket: async () => ticket,
    descargar: async () => Buffer.from("x"),
    extraerTexto: async () => TEXTO,
    llamarGemini: async () => respuestaOk,
    guardar: async (_id, r) => { guardados.push(r); },
    ahora: () => new Date("2026-10-08T12:00:00.000Z"),
    ...over,
  };
  return { deps, guardados };
}

describe("generarResumenContrato", () => {
  it("guarda pendiente primero y listo al final, con discrepancias", async () => {
    const { deps, guardados } = montar();
    const r = await generarResumenContrato(deps, "t1");
    expect(guardados.map((g) => g.estado)).toEqual(["pendiente", "listo"]);
    expect(guardados.map((g) => g.contratoUrl)).toEqual([CONTRATO, CONTRATO]);
    expect(r.estado).toBe("listo");
    expect(r.contratoUrl).toBe(CONTRATO);
    expect(r.contratoNombre).toBe("QRO01_CONTRATO_ARRENDAMIENTO.docx");
    expect(r.extraccion?.formaPago).toBe("mensual");
    expect(r.discrepancias.map((d) => d.campo)).toEqual(["domicilio"]);
    expect(r.generadoEn).toBe("2026-10-08T12:00:00.000Z");
  });

  it("sin contrato guarda sin_contrato y no llama a Gemini", async () => {
    let llamadas = 0;
    const { deps } = montar({ llamarGemini: async () => { llamadas++; return respuestaOk; } }, buildTicket({ id: "t1", documentacion: [] }));
    const r = await generarResumenContrato(deps, "t1");
    expect(r.estado).toBe("sin_contrato");
    expect(r.contratoUrl).toBeNull();
    expect(llamadas).toBe(0);
  });

  it("si Gemini falla guarda error generico sin filtrar el detalle", async () => {
    const { deps } = montar({ llamarGemini: async () => { throw new Error("API key abc secreta"); } });
    const r = await generarResumenContrato(deps, "t1");
    expect(r.estado).toBe("error");
    expect(r.contratoUrl).toBe(CONTRATO);
    expect(r.error).toBe("No se pudo generar el resumen.");
    expect(JSON.stringify(r)).not.toContain("secreta");
  });

  it("si la respuesta no es valida guarda error", async () => {
    const { deps } = montar({ llamarGemini: async () => "no json" });
    expect((await generarResumenContrato(deps, "t1")).estado).toBe("error");
  });

  it("un docx sin texto util es error y no llama a Gemini", async () => {
    let llamadas = 0;
    const { deps } = montar({ extraerTexto: async () => "   ", llamarGemini: async () => { llamadas++; return respuestaOk; } });
    expect((await generarResumenContrato(deps, "t1")).estado).toBe("error");
    expect(llamadas).toBe(0);
  });

  it("acepta un archivo elegido solo si pertenece al ticket y es docx", async () => {
    const otro = url("2_otro.docx");
    const { deps } = montar({}, buildTicket({ id: "t1", documentacion: [CONTRATO, otro] }));
    const r = await generarResumenContrato(deps, "t1", otro);
    expect(r.contratoNombre).toBe("otro.docx");
    expect(r.contratoUrl).toBe(otro);
    await expect(generarResumenContrato(deps, "t1", url("9_ajeno.docx"))).rejects.toThrow("no pertenece");

    const pdf = url("3_x.pdf");
    const { deps: depsPdf } = montar({}, buildTicket({ id: "t1", documentacion: [pdf] }));
    await expect(generarResumenContrato(depsPdf, "t1", pdf)).rejects.toThrow("docx");
  });

  it("un ticket inexistente lanza", async () => {
    const { deps } = montar({}, null);
    await expect(generarResumenContrato(deps, "t1")).rejects.toThrow("no encontrado");
  });

  it("ningun resumen guardado contiene claves undefined", async () => {
    const { deps, guardados } = montar();
    await generarResumenContrato(deps, "t1");
    for (const g of guardados) expect(Object.values(g)).not.toContain(undefined);
  });
});

describe("puedeGenerarResumen", () => {
  const ticket = buildTicket({ solicitanteId: "dueno" });

  it.each(["mesa_control", "abogado", "gerente_juridico", "admin"] as const)("%s puede y elige archivo", (role) => {
    expect(puedeGenerarResumen({ uid: "x", role }, ticket)).toEqual({ permitido: true, puedeElegirArchivo: true });
  });

  it("el dueno puede solo si no hay resumen o fallo, y no elige archivo", () => {
    expect(puedeGenerarResumen({ uid: "dueno", role: "solicitante" }, ticket)).toEqual({ permitido: true, puedeElegirArchivo: false });
    const listo = buildTicket({ solicitanteId: "dueno", resumenContrato: { estado: "listo", extraccion: null, discrepancias: [], contratoNombre: null, generadoEn: null } });
    expect(puedeGenerarResumen({ uid: "dueno", role: "solicitante" }, listo).permitido).toBe(false);
    const fallo = buildTicket({ solicitanteId: "dueno", resumenContrato: { estado: "error", extraccion: null, discrepancias: [], contratoNombre: null, generadoEn: null } });
    expect(puedeGenerarResumen({ uid: "dueno", role: "solicitante" }, fallo).permitido).toBe(true);
  });

  it("otro solicitante o el jefe de zona no pueden", () => {
    expect(puedeGenerarResumen({ uid: "otro", role: "solicitante" }, ticket).permitido).toBe(false);
    expect(puedeGenerarResumen({ uid: "j", role: "jefe_zona" }, ticket).permitido).toBe(false);
    expect(puedeGenerarResumen({ uid: "g", role: "gerente_area" }, ticket).permitido).toBe(false);
  });
});
