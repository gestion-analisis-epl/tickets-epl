import { NextResponse } from "next/server";
import { requireAdmin, ApiAuthError } from "@/lib/api-auth";
import { getAdminBucket } from "@/lib/firebase-admin";
import { rutaDeUrlStorage } from "@/lib/storage-ruta";
import { cargarTicketServidor, guardarEtiquetasServidor } from "@/lib/etiquetas-servidor";
import { pedirEtiquetaGemini } from "@/infrastructure/gemini/etiqueta-client";
import { etiquetarDocumentosDelTicket, type DepsEtiquetas } from "@/domain/documentos/etiquetar-documentos-service";
import { MAX_BYTES_IMAGEN_ETIQUETA } from "@/domain/documentos/etiquetas-rules";

export const runtime = "nodejs";
export const maxDuration = 60;

async function descargar(url: string): Promise<Buffer> {
  const ruta = rutaDeUrlStorage(url);
  if (!ruta) throw new Error("URL de documento invalida.");
  const file = getAdminBucket().file(ruta);
  const [metadata] = await file.getMetadata();
  if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) > MAX_BYTES_IMAGEN_ETIQUETA) throw new Error("excede el limite");
  const [buffer] = await file.download();
  return buffer;
}

// Solo admin (se dispara desde Configuracion > Mantenimiento). Etiqueta con IA los adjuntos con nombre generico de un ticket.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const ticketId = String(body.ticketId ?? "");
    if (!ticketId) return NextResponse.json({ error: "Falta el ticketId." }, { status: 400 });

    const deps: DepsEtiquetas = { cargarTicket: cargarTicketServidor, descargar, pedirEtiqueta: pedirEtiquetaGemini, guardar: guardarEtiquetasServidor };
    return NextResponse.json(await etiquetarDocumentosDelTicket(deps, ticketId));
  } catch (err) {
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.message === "Ticket no encontrado.") return NextResponse.json({ error: err.message }, { status: 404 });
    console.error("POST /api/documentos/etiquetar fallo.");
    return NextResponse.json({ error: "No se pudieron etiquetar los documentos." }, { status: 500 });
  }
}
