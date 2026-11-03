// Storage guarda `{timestamp}_{nombre}` (ver lib/storage.ts); se quita el prefijo.
export function nombreDeUrl(url: string): string {
  try {
    const ruta = decodeURIComponent(new URL(url).pathname);
    const archivo = ruta.slice(ruta.lastIndexOf("/") + 1);
    return archivo.replace(/^\d+_/, "");
  } catch {
    return "";
  }
}
