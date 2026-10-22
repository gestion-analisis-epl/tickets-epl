import { NextResponse } from "next/server";
import { requirePermiso, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { esTipoDeProceso, type TipoHistorial } from "@/types/historial";

export const runtime = "nodejs";
export const maxDuration = 60;

const LOTE = 400;

// Marca como visibles para el solicitante y los abogados las entradas de proceso (etapa, responsable, cierre...)
// escritas antes de que esos cambios fueran visibles sin importar quien los hiciera. Las reglas niegan el update
// desde el cliente: solo se puede con Admin SDK. Se recorre ticket por ticket para no exigir un indice de grupo.
export async function POST(request: Request) {
  try {
    await requirePermiso(request, "usar_mantenimiento");
    const db = getAdminDb();

    let revisadas = 0;
    let actualizadas = 0;
    let lote = db.batch();
    let enLote = 0;

    const tickets = await db.collection("tickets").select().get();
    for (const ticket of tickets.docs) {
      const entradas = await ticket.ref.collection("historial").get();
      for (const entrada of entradas.docs) {
        revisadas++;
        const data = entrada.data();
        if (!esTipoDeProceso(data.tipo as TipoHistorial) || data.visibleSolicitante === true) continue;
        lote.update(entrada.ref, { visibleSolicitante: true });
        actualizadas++;
        if (++enLote >= LOTE) {
          await lote.commit();
          lote = db.batch();
          enLote = 0;
        }
      }
    }
    if (enLote > 0) await lote.commit();

    return NextResponse.json({ revisadas, actualizadas });
  } catch (err) {
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/mantenimiento/historial-visibilidad fallo:", err instanceof Error ? err.message : "error desconocido");
    return NextResponse.json({ error: "No se pudo actualizar el historial." }, { status: 500 });
  }
}
