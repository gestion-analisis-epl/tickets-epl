import { NextResponse } from "next/server";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { leerSitios } from "@/lib/sitios-server";

export const runtime = "nodejs";

// Catalogo de sitios (Google Sheets) para el selector de Clave / Alias / Vista.
export async function GET(request: Request) {
  try {
    await verifyCallerToken(request);
    return NextResponse.json(await leerSitios());
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/sitios", err);
    return NextResponse.json({ error: "No se pudo cargar el catalogo de sitios." }, { status: 503 });
  }
}
