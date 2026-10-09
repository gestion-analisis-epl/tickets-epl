import { NextResponse } from "next/server";
import { verifyCallerToken, ApiAuthError } from "@/lib/api-auth";
import { getAdminBucket, getAdminDb } from "@/lib/firebase-admin";
import { extraerTextoDocx } from "@/lib/docx-texto";
import { rutaDeUrlStorage, sinUndefined } from "@/lib/storage-ruta";
import { llamarGemini } from "@/infrastructure/gemini/gemini-client";
import { generarResumenContrato, puedeGenerarResumen, ValidacionResumenError, type DepsResumen } from "@/domain/contratos/resumir-contrato-service";
import { construirResumenContrato } from "@/domain/contratos/contrato-rules";
import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { Role } from "@/types/user";

export const runtime = "nodejs";
export const maxDuration = 60;

async function cargarTicket(id: string): Promise<Ticket | null> {
  const snap = await getAdminDb().collection("tickets").doc(id).get();
  return snap.exists ? ({ ...snap.data(), id: snap.id } as Ticket) : null;
}

// Mismo limite que MAX_FILE_SIZE_BYTES de lib/storage.ts (modulo de cliente, no se importa en el servidor).
const MAX_BYTES_DESCARGA = 20 * 1024 * 1024;

async function descargar(url: string): Promise<Buffer> {
  const ruta = rutaDeUrlStorage(url);
  if (!ruta) throw new Error("URL de documento invalida.");
  try {
    const file = getAdminBucket().file(ruta);
    const [metadata] = await file.getMetadata();
    const tamano = Number(metadata.size);
    if (!Number.isFinite(tamano) || tamano > MAX_BYTES_DESCARGA) throw new Error("excede el limite");
    const [buffer] = await file.download();
    return buffer;
  } catch {
    throw new Error("No se pudo descargar el documento.");
  }
}

// Guarda en el ticket y, si el ticket ya esta en Pre-Cierre/Cierre (existe su resumen), lo refresca.
async function guardar(ticketId: string, resumen: Parameters<DepsResumen["guardar"]>[1]): Promise<void> {
  const db = getAdminDb();
  const ticketRef = db.collection("tickets").doc(ticketId);
  await ticketRef.update({ resumenContrato: sinUndefined(resumen) });

  const resumenRef = db.collection("resumenesContrato").doc(ticketId);
  const previo = await resumenRef.get();
  if (!previo.exists) return;
  const ticket = { ...(await ticketRef.get()).data(), id: ticketId } as Ticket;
  await resumenRef.set(sinUndefined(construirResumenContrato(ticket, new Date(), previo.data() as ResumenContrato)));
}

export async function POST(request: Request) {
  try {
    const uid = await verifyCallerToken(request);
    const body = await request.json();
    const ticketId = String(body.ticketId ?? "");
    const archivoUrl = typeof body.archivoUrl === "string" && body.archivoUrl ? body.archivoUrl : undefined;
    if (!ticketId) return NextResponse.json({ error: "Falta el ticketId." }, { status: 400 });

    const ticket = await cargarTicket(ticketId);
    if (!ticket) return NextResponse.json({ error: "Ticket no encontrado." }, { status: 404 });

    const caller = (await getAdminDb().collection("users").doc(uid).get()).data();
    const permiso = puedeGenerarResumen({ uid, role: (caller?.role ?? "solicitante") as Role }, ticket);
    if (!permiso.permitido) return NextResponse.json({ error: "No puedes generar el resumen de este ticket." }, { status: 403 });

    const deps: DepsResumen = { cargarTicket, descargar, extraerTexto: extraerTextoDocx, llamarGemini, guardar, ahora: () => new Date() };
    const resumen = await generarResumenContrato(deps, ticketId, permiso.puedeElegirArchivo ? archivoUrl : undefined);
    return NextResponse.json({ estado: resumen.estado });
  } catch (err) {
    if (err instanceof ValidacionResumenError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ApiAuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    // No se registra el error crudo: puede traer datos del contrato o credenciales.
    console.error("POST /api/contratos/resumir fallo.");
    return NextResponse.json({ error: "No se pudo generar el resumen." }, { status: 500 });
  }
}
