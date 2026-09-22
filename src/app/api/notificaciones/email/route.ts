import { NextResponse } from "next/server";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { enviarNotificacionEmail } from "@/lib/notificaciones-email";
import type { TipoNotificacion } from "@/lib/notificaciones";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await verifyCallerToken(request);

    const body = await request.json();
    const tipo = body.tipo as TipoNotificacion;
    const mensaje = String(body.mensaje ?? "");
    const ticketId = String(body.ticketId ?? "");
    const ticketFolio = String(body.ticketFolio ?? "");
    const tokenCalificacion = typeof body.tokenCalificacion === "string" ? body.tokenCalificacion : undefined;

    const enviados = await enviarNotificacionEmail({ tipo, mensaje, ticketId, ticketFolio, tokenCalificacion });

    return NextResponse.json({ ok: true, enviados });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/notificaciones/email", err);
    return NextResponse.json({ error: "No se pudo enviar el correo." }, { status: 500 });
  }
}
