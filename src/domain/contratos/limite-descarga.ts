import type { TipoContrato } from "./tipo-archivo";

const MB = 1024 * 1024;

// docx: mismo limite que MAX_FILE_SIZE_BYTES de lib/storage.ts (modulo de cliente, no se importa en el servidor).
// pdf: Gemini admite ~20 MB por peticion completa y base64 agrega ~33%, asi que el PDF original no debe pasar de ~14 MB.
export function limiteBytesContrato(tipo: TipoContrato): number {
  return tipo === "pdf" ? 14 * MB : 20 * MB;
}
