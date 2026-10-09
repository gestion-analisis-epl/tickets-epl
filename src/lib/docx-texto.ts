import JSZip from "jszip";

const MAX_CARACTERES_XML = 10 * 1024 * 1024;

// Un .docx es un zip; el texto vive en word/document.xml, repartido en tags <w:t>.
export async function extraerTextoDocx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("El archivo no tiene word/document.xml — no es un .docx valido.");

  if (documentXml.length > MAX_CARACTERES_XML) throw new Error("El documento es demasiado grande.");

  const runs = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
  return runs.map((run) => run.replace(/<[^>]+>/g, "")).join(" ");
}
