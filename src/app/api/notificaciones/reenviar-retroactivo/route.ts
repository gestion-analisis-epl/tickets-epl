import { NextResponse } from "next/server";
import { requireAdmin, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { destinatariosReales, enviarNotificacionEmail } from "@/lib/notificaciones-email";
import type { TipoNotificacion } from "@/lib/notificaciones";
import type { Ticket } from "@/types/ticket";

export const runtime = "nodejs";
// La pausa entre correos (ver abajo) hace que ~50 envios tarden cerca de un
// minuto — el limite por defecto (10s) cortaria la funcion a la mitad.
export const maxDuration = 60;

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
  // creacion_solicitante no se reenvia: ya se mando bien la primera vez
  // (no dependia del vinculo abogado<->usuario que estaba roto).

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
            // Pausa entre envios reales: margen extra para Gmail ademas del
            // pool de conexion reutilizada en lib/email.ts.
            await new Promise((r) => setTimeout(r, 300));
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
