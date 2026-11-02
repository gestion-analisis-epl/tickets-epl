import type { DocumentoGemini } from "@/domain/contratos/resumir-contrato-service";

export const INSTRUCCION_PDF = "Extrae los datos de los documentos adjuntos.";

type Parte = { text: string } | { inlineData: { mimeType: string; data: string } };

// Un solo mensaje con todos los documentos: cada uno lleva antes su nombre, para que el modelo sepa que es.
export function aContents(documentos: DocumentoGemini[]) {
  const parts: Parte[] = [];
  for (const { etiqueta, contenido } of documentos) {
    parts.push({ text: `Documento: ${etiqueta}` });
    if (contenido.tipo === "texto") parts.push({ text: contenido.texto });
    else parts.push({ inlineData: { mimeType: "application/pdf", data: contenido.base64 } });
  }
  parts.push({ text: INSTRUCCION_PDF });
  return [{ role: "user", parts }];
}
