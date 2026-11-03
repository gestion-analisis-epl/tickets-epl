import { NextResponse } from "next/server";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { cargarTicketServidor, guardarEtiquetasServidor } from "@/lib/etiquetas-servidor";
import { aplicarEtiqueta } from "@/domain/documentos/etiquetas-rules";
import { puedeEditarEtiquetas } from "@/domain/documentos/etiquetas-permisos";
import type { Role } from "@/types/user";

export const runtime = "nodejs";

// Admin o abogado corrigen a mano la etiqueta de un adjunto. Etiqueta vacia = volver al nombre original.
export async function POST(request: Request) {
  try {
    const uid = await verifyCallerToken(request);
    const caller = (await getAdminDb().collection("users").doc(uid).get()).data();
    if (!puedeEditarEtiquetas((caller?.role ?? "solicitante") as Role)) {
      return NextResponse.json({ error: "Solo un admin o un abogado puede cambiar el nombre de un documento." }, { status: 403 });
    }

    const body = await request.json();
    const ticketId = String(body.ticketId ?? "");
    const url = String(body.url ?? "");
    const etiqueta = typeof body.etiqueta === "string" ? body.etiqueta : "";
    if (!ticketId || !url) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });

    const ticket = await cargarTicketServidor(ticketId);
    if (!ticket) return NextResponse.json({ error: "Ticket no encontrado." }, { status: 404 });
    if (!ticket.documentacion.includes(url)) return NextResponse.json({ error: "El documento no pertenece al ticket." }, { status: 400 });

    await guardarEtiquetasServidor(ticketId, aplicarEtiqueta(ticket.etiquetasDocumentos, { url, etiqueta, origen: "manual" }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/documentos/etiqueta-manual fallo.");
    return NextResponse.json({ error: "No se pudo guardar el nombre." }, { status: 500 });
  }
}
