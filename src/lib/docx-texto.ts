import JSZip from "jszip";

// Un .docx es un zip; el texto vive en word/document.xml, repartido en tags <w:t>.
export async function extraerTextoDocx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("El archivo no tiene word/document.xml — no es un .docx valido.");

  const runs = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
  return runs.map((run) => run.replace(/<[^>]+>/g, "")).join(" ");
}
