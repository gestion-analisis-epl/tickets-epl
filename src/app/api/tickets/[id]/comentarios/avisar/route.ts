import { NextResponse } from "next/server";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { avisarConversacion } from "@/lib/avisos-conversacion";
import { decidirAvisoComentario } from "@/domain/notificaciones/conversacion-avisos";
import type { NuevoComentario } from "@/types/comentario";

export const runtime = "nodejs";

interface Params {
  params: { id: string };
}

// El cliente avisa "cree el comentario X"; aqui se valida que quien llama es su autor y que no se aviso antes.
export async function POST(request: Request, { params }: Params) {
  try {
    const uid = await verifyCallerToken(request);
    const body = await request.json().catch(() => null);
    const comentarioId = typeof body?.comentarioId === "string" ? body.comentarioId : "";
    if (!comentarioId) return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });

    const db = getAdminDb();
    const ref = db.collection("tickets").doc(params.id).collection("comentarios").doc(comentarioId);
    // Transaccion: dos llamadas simultaneas no mandan el aviso dos veces.
    const { decision, autorNombre } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const comentario = snap.exists ? (snap.data() as NuevoComentario) : null;
      const d = decidirAvisoComentario(comentario, uid);
      if (d === "avisar") tx.update(ref, { avisoEnviado: true });
      return { decision: d, autorNombre: comentario?.autorNombre ?? "" };
    });

    if (decision === "prohibido") {
      return NextResponse.json({ error: "No puedes avisar sobre este comentario." }, { status: 403 });
    }
    if (decision === "avisar") {
      try {
        await avisarConversacion({ tipo: "comentario_ticket", ticketId: params.id, autorUid: uid, autorNombre });
      } catch (err) {
        // Sin el texto del comentario ni datos del ticket.
        console.error("Aviso de comentario fallo:", err instanceof Error ? err.message : "error desconocido");
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/tickets/[id]/comentarios/avisar fallo.");
    return NextResponse.json({ error: "No se pudo enviar el aviso." }, { status: 500 });
  }
}
