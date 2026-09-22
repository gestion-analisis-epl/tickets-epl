import { NextResponse } from "next/server";
import { requireAdmin, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// Prende la bandera que revisa el loop de ../route.ts entre cada correo —
// permite frenar un envio real ya en curso (otra request, misma bandera en
// Firestore) sin depender de que el cliente siga conectado.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    await getAdminDb().collection("meta").doc("reenvioRetroactivo").set({ cancelado: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/notificaciones/reenviar-retroactivo/cancelar", err);
    return NextResponse.json({ error: "No se pudo detener el envio." }, { status: 500 });
  }
}
