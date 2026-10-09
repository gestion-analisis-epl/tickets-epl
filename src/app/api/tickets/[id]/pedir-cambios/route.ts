import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { sinUndefined } from "@/lib/storage-ruta";
import { avisarConversacion } from "@/lib/avisos-conversacion";
import {
  pedirCambios,
  PedirCambiosError,
  type DepsPedirCambios,
  type OperacionPedirCambios,
} from "@/domain/tickets/pedir-cambios-service";
import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { Role } from "@/types/user";

export const runtime = "nodejs";

interface Params {
  params: { id: string };
}

// Ticket, resumen, comentario e historial en una transaccion. Se vuelve a comprobar que el ticket siga en
// Pre-Cierre: Legal pudo moverlo entre la lectura y la escritura.
async function guardar(db: Firestore, op: OperacionPedirCambios): Promise<void> {
  const ticketRef = db.collection("tickets").doc(op.ticketId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ticketRef);
    if (snap.data()?.estatus !== "Pre-Cierre") throw new PedirCambiosError(409, "El ticket ya no esta en Pre-Cierre.");
    tx.update(ticketRef, sinUndefined(op.patchTicket));
    if (op.patchResumen) tx.update(db.collection("resumenesContrato").doc(op.ticketId), sinUndefined(op.patchResumen));
    tx.set(ticketRef.collection("comentarios").doc(op.comentarioId), sinUndefined(op.comentario));
    tx.set(ticketRef.collection("historial").doc(), sinUndefined(op.entrada));
  });
}

export async function POST(request: Request, { params }: Params) {
  try {
    const uid = await verifyCallerToken(request);
    const body = await request.json().catch(() => null);
    const db = getAdminDb();

    const deps: DepsPedirCambios = {
      cargarUsuario: async (u) => {
        const data = (await db.collection("users").doc(u).get()).data();
        return data ? { nombre: String(data.nombre ?? ""), role: data.role as Role, activo: data.activo !== false } : null;
      },
      cargarTicket: async (id) => {
        const snap = await db.collection("tickets").doc(id).get();
        return snap.exists ? ({ ...snap.data(), id: snap.id } as Ticket) : null;
      },
      cargarResumen: async (id) => {
        const snap = await db.collection("resumenesContrato").doc(id).get();
        return snap.exists ? (snap.data() as ResumenContrato) : null;
      },
      nuevoIdComentario: (id) => db.collection("tickets").doc(id).collection("comentarios").doc().id,
      guardar: (op) => guardar(db, op),
      avisar: (info) => avisarConversacion({ tipo: "cambios_solicitados", ...info }),
      ahora: () => new Date(),
    };

    await pedirCambios(deps, uid, params.id, body?.texto);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PedirCambiosError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    // Solo el mensaje: nunca el texto del comentario ni el cuerpo de la solicitud.
    console.error("POST /api/tickets/[id]/pedir-cambios fallo:", err instanceof Error ? err.message : "error desconocido");
    return NextResponse.json({ error: "No se pudieron pedir los cambios." }, { status: 500 });
  }
}
