import { extraerTextoDocx } from "@/lib/docx-texto";
import type { ContenidoGemini } from "@/domain/contratos/resumir-contrato-service";
import type { TipoContrato } from "@/domain/contratos/tipo-archivo";

export async function prepararContenido(buffer: Buffer, tipo: TipoContrato): Promise<ContenidoGemini> {
  if (tipo === "pdf") return { tipo: "pdf", base64: buffer.toString("base64") };
  return { tipo: "texto", texto: await extraerTextoDocx(buffer) };
}
