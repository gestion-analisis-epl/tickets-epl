import { auth } from "./firebase";
import type { ResultadoSitios } from "@/domain/sitios/sitios-cache";
import { crearCacheSesionSitios } from "@/domain/sitios/sitios-sesion";

const TTL_SESION_MS = 30 * 60 * 1000;

async function pedirSitios(): Promise<ResultadoSitios> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Sesion no valida. Vuelve a iniciar sesion.");

  const res = await fetch("/api/sitios", { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(cuerpo?.error ?? "No se pudo cargar el catalogo de sitios.");
  }
  return res.json();
}

// Catalogo completo en memoria y en sessionStorage: se pide una vez por sesion (o al vencer el TTL).
const cacheSitios = crearCacheSesionSitios({
  cargar: pedirSitios,
  almacen: typeof window === "undefined" ? null : window.sessionStorage,
  ttlMs: TTL_SESION_MS,
});

export const leerSitios = cacheSitios.leer;

// Calienta la cache al abrir una pantalla que va a necesitar el catalogo; un fallo aqui no se reporta.
export function precargarSitios(): void {
  cacheSitios.leer().catch(() => {});
}
