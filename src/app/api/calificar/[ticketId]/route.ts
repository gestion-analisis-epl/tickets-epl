import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

interface Params {
  params: { ticketId: string };
}

// Sin autenticacion Firebase a proposito: se llega aqui desde un link de
// correo (ver app/calificar/[ticketId]/page.tsx), no desde una sesion
// iniciada. El token (guardado en el ticket al cerrarse, ver lib/tickets.ts)
// es lo que autoriza — por eso valida tambien que el ticket este en Cierre y
// que no se haya calificado ya, para que el link no sirva mas de una vez.
async function ticketConToken(ticketId: string, token: string) {
  const ref = adminDb.collection("tickets").doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) return { error: "Ticket no encontrado.", status: 404 } as const;

  const ticket = snap.data()!;
  if (!token || ticket.tokenCalificacion !== token) {
    return { error: "Este link no es valido.", status: 403 } as const;
  }
  if (ticket.estatus !== "Cierre") {
    return { error: "Este ticket todavia no esta cerrado.", status: 400 } as const;
  }

  return { ticket, ref } as const;
}

export async function GET(request: Request, { params }: Params) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const resultado = await ticketConToken(params.ticketId, token);
  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  const { ticket } = resultado;
  const servicioSnap = await adminDb.collection("catalogoServicios").doc(ticket.servicioId).get();
  return NextResponse.json({
    folio: ticket.folio,
    servicio: servicioSnap.data()?.servicio ?? ticket.servicioId,
    yaCalificado: ticket.satisfaccion != null,
    satisfaccion: ticket.satisfaccion ?? null,
  });
}

export async function POST(request: Request, { params }: Params) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "");

    const resultado = await ticketConToken(params.ticketId, token);
    if ("error" in resultado) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }
    const { ticket, ref } = resultado;

    if (ticket.satisfaccion != null) {
      return NextResponse.json({ error: "Este ticket ya fue calificado." }, { status: 409 });
    }

    const satisfaccion = Number(body.satisfaccion);
    if (!Number.isInteger(satisfaccion) || satisfaccion < 1 || satisfaccion > 10) {
      return NextResponse.json({ error: "Calificacion invalida." }, { status: 400 });
    }
    const comentario = typeof body.comentario === "string" ? body.comentario.trim().slice(0, 2000) : "";

    await ref.update({ satisfaccion, ...(comentario ? { comentarioSatisfaccion: comentario } : {}) });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/calificar/[ticketId]", err);
    return NextResponse.json({ error: "No se pudo enviar la calificacion." }, { status: 500 });
  }
}
