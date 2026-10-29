import { NextResponse } from "next/server";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { leerSitios } from "@/lib/sitios-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Catalogo de sitios (Google Sheets) para el selector de Clave / Alias / Vista.
export async function GET(request: Request) {
  try {
    await verifyCallerToken(request);
    const forzar = new URL(request.url).searchParams.get("forzar") === "1";
    return NextResponse.json(await leerSitios({ forzar }));
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/sitios", err);
    return NextResponse.json({ error: "No se pudo cargar el catalogo de sitios." }, { status: 503 });
  }
}
