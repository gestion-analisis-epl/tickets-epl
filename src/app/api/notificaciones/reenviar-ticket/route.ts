import { NextResponse } from "next/server";
import { requirePermiso, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { APP_URL, enviarNotificacionEmailA } from "@/lib/notificaciones-email";

export const runtime = "nodejs";

// Envio puntual de un solo ticket a una sola persona (p.ej. el aviso que no le llego a quien cubre al
// gerente juridico). Solo a cuentas activas registradas: no manda a correos arbitrarios.
export async function POST(request: Request) {
  try {
    await requirePermiso(request, "usar_mantenimiento");

    const body = await request.json().catch(() => ({}));
    const folio = typeof body?.folio === "string" ? body.folio.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const tipo = body?.tipo === "cambio_estatus" ? "cambio_estatus" : "nuevo_ticket";
    if (!folio || !email) return NextResponse.json({ error: "Indica el folio y el correo." }, { status: 400 });

    const db = getAdminDb();
    const [ticketSnap, usuarioSnap] = await Promise.all([
      db.collection("tickets").where("folio", "==", folio).limit(1).get(),
      db.collection("users").where("email", "==", email).limit(1).get(),
    ]);
    const ticketDoc = ticketSnap.docs[0];
    if (!ticketDoc) return NextResponse.json({ error: `No existe el ticket ${folio}.` }, { status: 404 });
    const usuario = usuarioSnap.docs[0]?.data();
    if (!usuario || usuario.activo === false) {
      return NextResponse.json({ error: "Ese correo no pertenece a un usuario activo." }, { status: 404 });
    }

    const ticket = ticketDoc.data();
    const mensaje = tipo === "cambio_estatus"
      ? `El ticket ${folio} esta en estatus: ${ticket.estatus}.`
      : `Nueva solicitud ${folio}.`;
    await enviarNotificacionEmailA(
      { tipo, mensaje, ticketId: ticketDoc.id, ticketFolio: folio },
      [email],
      `${APP_URL}/tickets/${ticketDoc.id}`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/notificaciones/reenviar-ticket", err);
    return NextResponse.json({ error: "No se pudo enviar el correo." }, { status: 500 });
  }
}
