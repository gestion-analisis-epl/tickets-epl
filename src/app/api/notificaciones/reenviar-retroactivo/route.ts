import { NextResponse } from "next/server";
import { requireAdmin, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { destinatariosReales, enviarNotificacionEmail } from "@/lib/notificaciones-email";
import type { TipoNotificacion } from "@/lib/notificaciones";
import type { Ticket } from "@/types/ticket";

export const runtime = "nodejs";

// Un solo uso: reenvia (o solo cuenta, en dry-run) los avisos de correo que
// no se mandaron bien por la falta de vinculo abogado<->usuario (ver
// ticket-notifier.ts para el flujo normal, que sigue siendo el mismo).
// Aplica solo a tickets desde este corte — antes de eso son de prueba (ver
// ticket-repository.ts CORTE_TICKETS_PRUEBA).
const CORTE = "2026-09-21T00:00:00.000Z";

interface Envio {
  tipo: TipoNotificacion;
  mensaje: string;
  ticketId: string;
  ticketFolio: string;
  tokenCalificacion?: string;
}

function planPorTicket(t: Ticket): Envio[] {
  const envios: Envio[] = [];
  const folio = t.folio ?? t.id;

  envios.push({ tipo: "nuevo_ticket", mensaje: `Nueva solicitud ${folio}.`, ticketId: t.id, ticketFolio: folio });
  envios.push({
    tipo: "creacion_solicitante",
    mensaje: `Tu ticket ${folio} fue creado y esta en revision.`,
    ticketId: t.id,
    ticketFolio: folio,
  });

  if (t.abogadoAsignadoId) {
    envios.push({ tipo: "asignacion", mensaje: `Te asignaron el ticket ${folio}.`, ticketId: t.id, ticketFolio: folio });
    envios.push({
      tipo: "asignacion_solicitante",
      mensaje: `Se asigno un responsable a tu ticket ${folio}.`,
      ticketId: t.id,
      ticketFolio: folio,
    });
  }

  if (t.estatus === "Cierre") {
    envios.push({
      tipo: "cierre",
      mensaje: `Tu ticket ${folio} fue cerrado.`,
      ticketId: t.id,
      ticketFolio: folio,
      tokenCalificacion: t.tokenCalificacion ?? undefined,
    });
  } else if (t.estatus && t.estatus !== "Recepcion de solicitud") {
    envios.push({
      tipo: "cambio_estatus",
      mensaje: `Tu ticket ${folio} cambio de estatus: ${t.estatus}.`,
      ticketId: t.id,
      ticketFolio: folio,
    });
  }

  return envios;
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const body = await request.json().catch(() => ({}));
    const send = body?.send === true;

    const db = getAdminDb();
    const snap = await db.collection("tickets").get();
    const tickets = snap.docs
      .map((d) => ({ ...d.data(), id: d.id }) as Ticket)
      .filter((t) => t.fechaSolicitud >= CORTE);

    const resumenPorTipo: Record<string, number> = {};
    const sinDestinatario: string[] = [];
    let totalCorreos = 0;

    for (const t of tickets) {
      for (const envio of planPorTicket(t)) {
        if (send) {
          const enviados = await enviarNotificacionEmail(envio);
          if (enviados > 0) {
            resumenPorTipo[envio.tipo] = (resumenPorTipo[envio.tipo] ?? 0) + 1;
            totalCorreos++;
          } else {
            sinDestinatario.push(`${envio.ticketFolio} — ${envio.tipo}`);
          }
        } else {
          const destinatarios = await destinatariosReales(envio.tipo, envio.ticketId);
          if (destinatarios.length > 0) {
            resumenPorTipo[envio.tipo] = (resumenPorTipo[envio.tipo] ?? 0) + 1;
            totalCorreos++;
          } else {
            sinDestinatario.push(`${envio.ticketFolio} — ${envio.tipo}`);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      modo: send ? "envio" : "dry-run",
      tickets: tickets.length,
      totalCorreos,
      resumenPorTipo,
      sinDestinatario,
    });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/notificaciones/reenviar-retroactivo", err);
    return NextResponse.json({ error: "No se pudo completar el reenvio." }, { status: 500 });
  }
}
