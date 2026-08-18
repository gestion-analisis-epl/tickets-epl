import { NextResponse } from "next/server";
import { enviarEmail } from "@/lib/email";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { LEGAL_STAFF_ROLES } from "@/types/user";
import type { TipoNotificacion } from "@/lib/notificaciones";

export const runtime = "nodejs";

const TIPO_LABEL: Record<TipoNotificacion, string> = {
  nuevo_ticket: "Nuevo ticket",
  asignacion: "Asignacion de abogado",
  cambio_estatus: "Cambio de estatus",
  cierre: "Cierre de ticket",
  creacion_solicitante: "Ticket creado",
  asignacion_solicitante: "Responsable asignado",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BOTON = "display:inline-block;padding:10px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600";

// Escotilla de seguridad: si esta variable trae correos, todo se redirige ahi
// en vez de a los destinatarios reales (ver .env.example).
const DESTINATARIOS_PRUEBA = (process.env.NOTIFICACIONES_DESTINATARIOS_PRUEBA ?? "")
  .split(",").map((e) => e.trim()).filter(Boolean);

async function destinatariosReales(tipo: TipoNotificacion, ticketId: string): Promise<string[]> {
  const db = getAdminDb();

  if (tipo === "nuevo_ticket") {
    const snap = await db.collection("users").where("role", "in", LEGAL_STAFF_ROLES).get();
    return snap.docs.map((d) => d.data()).filter((u) => u.activo && u.email).map((u) => u.email as string);
  }

  const ticket = (await db.collection("tickets").doc(ticketId).get()).data();
  if (!ticket) return [];

  if (tipo === "asignacion") {
    if (!ticket.abogadoAsignadoId) return [];
    const snap = await db.collection("users").where("abogadoId", "==", ticket.abogadoAsignadoId).limit(1).get();
    const email = snap.docs[0]?.data().email;
    return email ? [email] : [];
  }

  const solicitante = (await db.collection("users").doc(ticket.solicitanteId).get()).data();
  return solicitante?.email ? [solicitante.email] : [];
}

export async function POST(request: Request) {
  try {
    await verifyCallerToken(request);

    const body = await request.json();
    const tipo = body.tipo as TipoNotificacion;
    const mensaje = String(body.mensaje ?? "");
    const ticketId = String(body.ticketId ?? "");
    const ticketFolio = String(body.ticketFolio ?? "");
    const tokenCalificacion = typeof body.tokenCalificacion === "string" ? body.tokenCalificacion : undefined;

    const destinatarios = DESTINATARIOS_PRUEBA.length ? DESTINATARIOS_PRUEBA : await destinatariosReales(tipo, ticketId);
    if (destinatarios.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

    const verTicketUrl = `${APP_URL}/tickets/${ticketId}`;
    const calificarUrl = tokenCalificacion ? `${APP_URL}/calificar/${ticketId}?token=${tokenCalificacion}` : null;

    await enviarEmail({
      to: destinatarios.join(", "),
      subject: `${TIPO_LABEL[tipo] ?? tipo} — ${ticketFolio}`,
      html: `
        <p>${mensaje}</p>
        <p style="color:#666;font-size:12px">Ticket: ${ticketFolio}</p>
        <p><a href="${verTicketUrl}" style="${BOTON}">Ver ticket</a></p>
        ${calificarUrl ? `<p><a href="${calificarUrl}" style="${BOTON};background:#15803d">Calificar tu experiencia</a></p>` : ""}
      `,
    });

    return NextResponse.json({ ok: true, enviados: destinatarios.length });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/notificaciones/email", err);
    return NextResponse.json({ error: "No se pudo enviar el correo." }, { status: 500 });
  }
}
