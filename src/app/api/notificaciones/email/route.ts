import { NextResponse } from "next/server";
import { enviarEmail } from "@/lib/email";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import type { TipoNotificacion } from "@/lib/notificaciones";

export const runtime = "nodejs";

const TIPO_LABEL: Record<TipoNotificacion, string> = {
  nuevo_ticket: "Nuevo ticket",
  asignacion: "Asignacion de abogado",
  cambio_estatus: "Cambio de estatus",
  cierre: "Cierre de ticket",
};

// PRUEBA: todo correo se redirige aqui sin importar el destinatario real (ver
// lib/notificaciones.ts) — quitar cuando se valide el flujo completo.
const DESTINATARIOS_PRUEBA = ["aescalante@grupoepl.com.mx", "aramirez@grupoepl.com.mx"];

// Sin NEXT_PUBLIC_APP_URL en el entorno, cae a localhost — solo util para
// quien prueba en su propia maquina. Configurarla con la URL real desplegada
// para que los links sirvan desde cualquier lado.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const BOTON = "display:inline-block;padding:10px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600";

export async function POST(request: Request) {
  try {
    await verifyCallerToken(request);

    const body = await request.json();
    const tipo = body.tipo as TipoNotificacion;
    const mensaje = String(body.mensaje ?? "");
    const ticketId = String(body.ticketId ?? "");
    const ticketFolio = String(body.ticketFolio ?? "");
    const tokenCalificacion = typeof body.tokenCalificacion === "string" ? body.tokenCalificacion : undefined;

    const verTicketUrl = `${APP_URL}/tickets/${ticketId}`;
    const calificarUrl = tokenCalificacion ? `${APP_URL}/calificar/${ticketId}?token=${tokenCalificacion}` : null;

    await enviarEmail({
      to: DESTINATARIOS_PRUEBA.join(", "),
      subject: `[Prueba] ${TIPO_LABEL[tipo] ?? tipo} — ${ticketFolio}`,
      html: `
        <p><strong>Modo de prueba:</strong> este correo se esta enviando solo a ${DESTINATARIOS_PRUEBA.join(" y ")}
        mientras se valida el sistema de notificaciones.</p>
        <p>${mensaje}</p>
        <p style="color:#666;font-size:12px">Ticket: ${ticketFolio}</p>
        <p><a href="${verTicketUrl}" style="${BOTON}">Ver ticket</a></p>
        ${calificarUrl ? `<p><a href="${calificarUrl}" style="${BOTON};background:#15803d">Calificar tu experiencia</a></p>` : ""}
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/notificaciones/email", err);
    return NextResponse.json({ error: "No se pudo enviar el correo." }, { status: 500 });
  }
}
