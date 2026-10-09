import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extraerTextoDocx } from "./docx-texto";

async function docx(xml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("extraerTextoDocx", () => {
  it("extrae el texto de los runs", async () => {
    expect(await extraerTextoDocx(await docx("<w:p><w:t>Hola</w:t><w:t>mundo</w:t></w:p>"))).toBe("Hola mundo");
  });

  it("rechaza un document.xml descomprimido demasiado grande", async () => {
    const enorme = "<w:t>x</w:t>" + " ".repeat(11 * 1024 * 1024);
    await expect(extraerTextoDocx(await docx(enorme))).rejects.toThrow("demasiado grande");
  });
});
