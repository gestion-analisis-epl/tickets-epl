import { auth } from "./firebase";

export interface ResultadoEtiquetadoCliente {
  etiquetados: number;
  sinIdentificar: number;
  errores: number;
}

async function llamar(ruta: string, cuerpo: unknown, errorPorDefecto: string): Promise<Response> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("No hay sesion activa.");
  const res = await fetch(ruta, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? errorPorDefecto);
  return res;
}

export async function solicitarEtiquetado(ticketId: string): Promise<ResultadoEtiquetadoCliente> {
  return (await llamar("/api/documentos/etiquetar", { ticketId }, "No se pudieron etiquetar los documentos.")).json();
}

export async function guardarEtiquetaManual(ticketId: string, url: string, etiqueta: string): Promise<void> {
  await llamar("/api/documentos/etiqueta-manual", { ticketId, url, etiqueta }, "No se pudo guardar el nombre.");
}
