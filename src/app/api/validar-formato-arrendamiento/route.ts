import { NextResponse } from "next/server";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { extraerTextoDocx } from "@/lib/docx-texto";
import { validarTextoFormatoArrendamiento } from "@/lib/formato-arrendamiento-validacion";
import { MAX_FILE_SIZE_BYTES } from "@/lib/storage";

export const runtime = "nodejs";

// Confirma que el .docx subido conserva los encabezados fijos de la plantilla oficial.
export async function POST(request: Request) {
  try {
    await verifyCallerToken(request);

    const body = await request.json();
    const url = String(body.url ?? "");
    if (!url) return NextResponse.json({ error: "Falta la URL del archivo." }, { status: 400 });

    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "No se pudo descargar el archivo para validarlo." }, { status: 400 });

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ valido: false });
    }

    try {
      const texto = await extraerTextoDocx(Buffer.from(arrayBuffer));
      return NextResponse.json({ valido: validarTextoFormatoArrendamiento(texto) });
    } catch {
      // No es un .docx valido — invalido, no un error de servidor.
      return NextResponse.json({ valido: false });
    }
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/validar-formato-arrendamiento", err);
    return NextResponse.json({ error: "No se pudo validar el archivo." }, { status: 500 });
  }
}
