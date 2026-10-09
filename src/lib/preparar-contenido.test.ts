import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/docx-texto", () => ({ extraerTextoDocx: vi.fn(async () => "texto extraido") }));

import { prepararContenido } from "./preparar-contenido";

describe("prepararContenido", () => {
  it("codifica el PDF en base64 sin extraer texto", async () => {
    const buffer = Buffer.from("ABC");
    expect(await prepararContenido(buffer, "pdf")).toEqual({ tipo: "pdf", base64: buffer.toString("base64") });
  });

  it("extrae el texto de un docx", async () => {
    expect(await prepararContenido(Buffer.from("x"), "docx")).toEqual({ tipo: "texto", texto: "texto extraido" });
  });
});
