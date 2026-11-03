import { GoogleGenAI, Type } from "@google/genai";

const MODELO_PREDETERMINADO = "gemini-3.8-flash";
const TIMEOUT_MS = 30_000;

const INSTRUCCIONES = `Eres un asistente del area legal de una empresa que renta predios para sitios de telecomunicaciones.
Recibes UN documento (foto, escaneo o PDF) adjunto a un tramite de arrendamiento. Dime que documento es.
Responde una etiqueta corta en español (maximo 6 palabras), como: "INE del arrendador (frente)", "INE del arrendador (reverso)",
"Escritura, página 2", "Predial 2026", "Comprobante de domicilio", "Contrato de arrendamiento", "Constancia de situación fiscal", "Fotografía del sitio".
Si el documento es de varias paginas, indica la pagina solo si se ve. No inventes datos personales ni numeros.
Si no se puede leer o no sabes que documento es, responde etiqueta null.`;

const ESQUEMA = {
  type: Type.OBJECT,
  properties: { etiqueta: { type: Type.STRING, nullable: true } },
  required: ["etiqueta"],
};

// Mismo cuidado que gemini-client: jamas se propaga el error original (puede traer la llave o el documento).
export async function pedirEtiquetaGemini(mimeType: string, base64: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en el entorno del servidor.");

  let texto: string | undefined;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const respuesta = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || MODELO_PREDETERMINADO,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64 } }, { text: "¿Que documento es?" }] }],
      config: {
        systemInstruction: INSTRUCCIONES,
        responseMimeType: "application/json",
        responseSchema: ESQUEMA,
        temperature: 0,
        httpOptions: { timeout: TIMEOUT_MS },
      },
    });
    texto = respuesta.text;
  } catch {
    throw new Error("Fallo la llamada a Gemini.");
  }

  if (!texto) throw new Error("Gemini no devolvio texto.");
  try {
    const valor = (JSON.parse(texto) as { etiqueta?: unknown }).etiqueta;
    return typeof valor === "string" && valor.trim() ? valor : null;
  } catch {
    throw new Error("Gemini devolvio un formato invalido.");
  }
}
