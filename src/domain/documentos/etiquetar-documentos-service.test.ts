import { describe, expect, it } from "vitest";
import { etiquetarDocumentosDelTicket, type DepsEtiquetas } from "./etiquetar-documentos-service";
import { buildTicket } from "@/test/ticket-fixture";
import type { EtiquetaDocumento } from "@/types/ticket";

const url = (n: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/tickets%2Ft1%2F${encodeURIComponent(`1730000_${n}`)}?alt=media&token=t`;
const A = url("IMG_1.jpeg"), B = url("IMG_2.jpeg"), C = url("IMG_3.jpeg");

function montar(respuestas: (string | null | Error)[]) {
  const guardados: EtiquetaDocumento[][] = [];
  let i = 0;
  const deps: DepsEtiquetas = {
    cargarTicket: async () => buildTicket({ id: "t1", documentacion: [A, B, C, url("Contrato.pdf")] }),
    descargar: async () => Buffer.from("x"),
    pedirEtiqueta: async () => {
      const r = respuestas[i++];
      if (r instanceof Error) throw r;
      return r;
    },
    guardar: async (_id, e) => { guardados.push(e); },
  };
  return { deps, guardados };
}

describe("etiquetarDocumentosDelTicket", () => {
  it("etiqueta, marca sin identificar y cuenta errores sin detenerse", async () => {
    const { deps, guardados } = montar(["INE del arrendador (frente)", null, new Error("falla")]);
    const r = await etiquetarDocumentosDelTicket(deps, "t1");
    expect(r).toEqual({ etiquetados: 1, sinIdentificar: 1, errores: 1 });
    const final = guardados.at(-1)!;
    expect(final).toEqual([
      { url: A, etiqueta: "INE del arrendador (frente)", origen: "ia" },
      { url: B, etiqueta: "Documento sin identificar", origen: "ia", sinIdentificar: true },
    ]);
  });

  it("no toca los archivos con nombre descriptivo", async () => {
    const { deps } = montar(["a", "b", "c"]);
    const r = await etiquetarDocumentosDelTicket(deps, "t1");
    expect(r.etiquetados).toBe(3);
  });
});
