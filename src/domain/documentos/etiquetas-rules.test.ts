import { describe, expect, it } from "vitest";
import {
  adjuntosSinEtiqueta, aplicarEtiqueta, esNombreGenerico, etiquetaDeAdjunto, ETIQUETA_SIN_IDENTIFICAR, limpiarEtiqueta, mimeEtiquetable, nombreParaZip,
} from "./etiquetas-rules";

const url = (n: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/tickets%2Ft1%2F${encodeURIComponent(`1730000_${n}`)}?alt=media&token=t`;

describe("esNombreGenerico", () => {
  it.each(["IMG_5212.jpeg", "PHOTO-2026-09-18-08-35-08_1_.jpg", "PHOTO-2026-09-18-08-35-08.jpg", "WhatsApp Image 2026-09-18 at 08.35.08.jpeg", "scan_001.pdf", "20260918_083508.jpg", "Captura de pantalla 2026-09-18.png"])(
    "%s es generico", (n) => expect(esNombreGenerico(n)).toBe(true)
  );
  it.each(["Contrato_final.pdf", "QRO01_CONTRATO_ARRENDAMIENTO.docx", "INE_Juan_Perez.jpg", "Predial 2026.pdf"])(
    "%s es descriptivo", (n) => expect(esNombreGenerico(n)).toBe(false)
  );
});

describe("mimeEtiquetable", () => {
  it("acepta imagenes y pdf, no docx", () => {
    expect(mimeEtiquetable("a.JPG")).toBe("image/jpeg");
    expect(mimeEtiquetable("a.pdf")).toBe("application/pdf");
    expect(mimeEtiquetable("a.docx")).toBeNull();
  });
});

describe("adjuntosSinEtiqueta", () => {
  it("solo los genericos legibles que aun no tienen etiqueta", () => {
    const a = url("IMG_1.jpeg"), b = url("IMG_2.jpeg"), c = url("Contrato.pdf"), d = url("IMG_3.docx");
    const t = { documentacion: [a, b, c, d], etiquetasDocumentos: [{ url: b, etiqueta: "Predial", origen: "manual" as const }] };
    expect(adjuntosSinEtiqueta(t)).toEqual([a]);
  });
});

describe("etiquetaDeAdjunto", () => {
  const u = url("IMG_1.jpeg");
  it("sin etiqueta usa el nombre original", () => expect(etiquetaDeAdjunto({}, u)).toBe("IMG_1.jpeg"));
  it("con etiqueta la usa", () => expect(etiquetaDeAdjunto({ etiquetasDocumentos: [{ url: u, etiqueta: "Predial 2026", origen: "ia" }] }, u)).toBe("Predial 2026"));
  it("sin identificar muestra el texto fijo", () =>
    expect(etiquetaDeAdjunto({ etiquetasDocumentos: [{ url: u, etiqueta: "", origen: "ia", sinIdentificar: true }] }, u)).toBe(ETIQUETA_SIN_IDENTIFICAR));
});

describe("aplicarEtiqueta", () => {
  it("reemplaza la existente y una etiqueta vacia la quita", () => {
    const u = "u1";
    const con = aplicarEtiqueta([{ url: u, etiqueta: "x", origen: "ia", sinIdentificar: true }], { url: u, etiqueta: "  INE  ", origen: "manual" });
    expect(con).toEqual([{ url: u, etiqueta: "INE", origen: "manual" }]);
    expect(aplicarEtiqueta(con, { url: u, etiqueta: "  ", origen: "manual" })).toEqual([]);
  });
});

describe("limpiarEtiqueta y nombreParaZip", () => {
  it("quita saltos y barras y recorta", () => {
    expect(limpiarEtiqueta(" INE\n del/arrendador ")).toBe("INE del-arrendador");
    expect(limpiarEtiqueta("x".repeat(100))).toHaveLength(60);
  });
  it("el ZIP conserva la extension original", () => expect(nombreParaZip("Predial 2026", "IMG_1.jpeg")).toBe("Predial 2026.jpeg"));
});
