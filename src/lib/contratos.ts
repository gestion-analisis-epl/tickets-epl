import { auth } from "./firebase";

export async function solicitarResumenContrato(ticketId: string, archivoUrl?: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("No hay sesion activa.");

  const res = await fetch("/api/contratos/resumir", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ticketId, archivoUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No se pudo generar el resumen.");
  return data.estado as string;
}
