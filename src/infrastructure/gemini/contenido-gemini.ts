import type { ContenidoGemini } from "@/domain/contratos/resumir-contrato-service";

export const INSTRUCCION_PDF = "Extrae los datos del contrato PDF adjunto.";

export function aContents(contenido: ContenidoGemini) {
  if (contenido.tipo === "texto") return contenido.texto;
  return [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: contenido.base64 } }, { text: INSTRUCCION_PDF }] }];
}
