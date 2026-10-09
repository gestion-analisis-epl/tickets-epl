// Solo se enlazan descargas servidas por Firebase Storage (https); cualquier otra URL se muestra como texto.
export function esUrlStorageSegura(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "firebasestorage.googleapis.com";
  } catch {
    return false;
  }
}

// Extrae la ruta del objeto en Storage a partir de una URL de descarga de Firebase
// (https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<ruta codificada>?alt=media&token=...).
// Exige el host de Storage: el servidor lee esa ruta con el Admin SDK, asi que una URL de otro
// host con la forma /o/<ruta> no debe poder apuntar a un objeto cualquiera del bucket.
export function rutaDeUrlStorage(url: string): string | null {
  if (!esUrlStorageSegura(url)) return null;
  try {
    return decodeURIComponent(new URL(url).pathname).match(/\/o\/(.+)$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Firestore Admin rechaza valores undefined; los elimina de forma profunda (objetos y arreglos).
export function sinUndefined<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}
