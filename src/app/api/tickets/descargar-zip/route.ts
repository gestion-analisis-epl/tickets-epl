import { NextResponse } from "next/server";
import JSZip from "jszip";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { getAdminBucket } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function nombreArchivo(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    return path.split("/").pop() ?? url;
  } catch {
    return url;
  }
}

// Firebase Storage no tiene CORS habilitado para el bucket de este proyecto,
// asi que el navegador no puede hacer fetch() directo a las URLs de descarga
// (un <a href> normal si funciona, pero eso no sirve para armar un ZIP en el
// cliente). Server-side no hay problema de CORS: el Admin SDK lee el bucket
// directo, arma el ZIP aqui y se lo manda al navegador como un solo archivo.
export async function POST(request: Request) {
  try {
    await verifyCallerToken(request);

    const body = await request.json();
    const urls: unknown = body.urls;
    if (!Array.isArray(urls) || urls.length === 0 || !urls.every((u) => typeof u === "string")) {
      return NextResponse.json({ error: "Faltan las URLs de los documentos a incluir." }, { status: 400 });
    }

    const bucket = getAdminBucket();
    const zip = new JSZip();
    const usados = new Set<string>();

    for (const url of urls as string[]) {
      const match = decodeURIComponent(new URL(url).pathname).match(/\/o\/(.+)$/);
      const filePath = match?.[1];
      if (!filePath) {
        return NextResponse.json({ error: `URL de documento invalida: ${url}` }, { status: 400 });
      }

      const [buffer] = await bucket.file(filePath).download();

      let nombre = nombreArchivo(url);
      let i = 1;
      while (usados.has(nombre)) nombre = `${i++}_${nombreArchivo(url)}`;
      usados.add(nombre);

      zip.file(nombre, buffer);
    }

    const contenido = await zip.generateAsync({ type: "blob" });
    return new NextResponse(contenido, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="documentacion.zip"',
      },
    });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/tickets/descargar-zip", err);
    return NextResponse.json({ error: "No se pudo generar el ZIP." }, { status: 500 });
  }
}
