import { GoogleAuth } from "google-auth-library";
import { crearLectorSitios } from "@/domain/sitios/sitios-cache";
import { parseFilasSitios, type Sitio } from "@/domain/sitios/sitios-rules";

// Solo se usa en rutas de servidor. Reutiliza la misma cuenta de servicio que firebase-admin
// (FIREBASE_SERVICE_ACCOUNT_JSON); la hoja debe estar compartida con su client_email como lector.
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TTL_MS = 5 * 60 * 1000;

function requerirEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta ${nombre} en el entorno del servidor — revisa tu .env.local.`);
  return valor;
}

async function cargarSitiosDeSheets(): Promise<Sitio[]> {
  const hojaId = requerirEnv("SITIOS_SHEET_ID");
  const pestana = requerirEnv("SITIOS_SHEET_TAB");

  const credencialesJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const auth = new GoogleAuth({
    scopes: [SCOPE],
    ...(credencialesJson ? { credentials: JSON.parse(credencialesJson) } : {}),
  });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("No se pudo obtener el token de acceso a Google Sheets.");

  // Las comillas simples dentro de un nombre de pestana se escapan duplicandolas.
  const rango = encodeURIComponent(`'${pestana.replace(/'/g, "''")}'`);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${hojaId}/values/${rango}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Sheets respondio ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as { values?: unknown[][] };
  return parseFilasSitios(data.values ?? []);
}

export const leerSitios = crearLectorSitios({ cargar: cargarSitiosDeSheets, ttlMs: TTL_MS });
