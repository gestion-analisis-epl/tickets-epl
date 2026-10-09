import { GoogleGenAI, Type } from "@google/genai";
import { INSTRUCCIONES_EXTRACCION } from "@/domain/contratos/extraccion-rules";
import type { ContenidoGemini } from "@/domain/contratos/resumir-contrato-service";

// Confirmar en AI Studio que este modelo sigue vigente; se puede sobrescribir con GEMINI_MODEL.
const MODELO_PREDETERMINADO = "gemini-2.5-flash";

const TIMEOUT_MS = 45_000;

const nulo = (type: Type) => ({ type, nullable: true });

const ESQUEMA = {
  type: Type.OBJECT,
  properties: {
    sitio: nulo(Type.STRING), codigo: nulo(Type.STRING), domicilio: nulo(Type.STRING),
    altaArrendador: nulo(Type.STRING), solicitante: nulo(Type.STRING),
    periodoInicio: nulo(Type.STRING), periodoFin: nulo(Type.STRING),
    condicionesPago: nulo(Type.STRING), montoPagoAnual: nulo(Type.NUMBER), formaPago: nulo(Type.STRING),
  },
};

// Los errores del SDK pueden traer la URL de la peticion (con la llave) o fragmentos del
// contrato: jamas se propaga el error original, solo un mensaje generico y el status numerico.
function estatusDe(err: unknown): number | null {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return null;
}

const INSTRUCCION_PDF = "Extrae los datos del contrato PDF adjunto.";

function aContents(contenido: ContenidoGemini) {
  if (contenido.tipo === "texto") return contenido.texto;
  return [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: contenido.base64 } }, { text: INSTRUCCION_PDF }] }];
}

export async function llamarGemini(contenido: ContenidoGemini): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en el entorno del servidor.");

  let texto: string | undefined;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const respuesta = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || MODELO_PREDETERMINADO,
      contents: aContents(contenido),
      config: {
        systemInstruction: INSTRUCCIONES_EXTRACCION,
        responseMimeType: "application/json",
        responseSchema: ESQUEMA,
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
        httpOptions: { timeout: TIMEOUT_MS },
      },
    });
    texto = respuesta.text;
  } catch (err) {
    const status = estatusDe(err);
    throw new Error(status === null ? "Fallo la llamada a Gemini." : `Fallo la llamada a Gemini (HTTP ${status}).`);
  }

  if (!texto) throw new Error("Gemini no devolvio texto.");
  return texto;
}
