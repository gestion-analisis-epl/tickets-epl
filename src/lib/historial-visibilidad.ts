import { auth } from "./firebase";

export interface ResultadoVisibilidadHistorial {
  revisadas: number;
  actualizadas: number;
}

export async function actualizarVisibilidadHistorial(): Promise<ResultadoVisibilidadHistorial> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("No hay sesion activa.");

  const res = await fetch("/api/mantenimiento/historial-visibilidad", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No se pudo actualizar el historial.");
  return data as ResultadoVisibilidadHistorial;
}
