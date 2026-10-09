// Extrae la ruta del objeto en Storage a partir de una URL de descarga de Firebase
// (https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<ruta codificada>?alt=media&token=...).
export function rutaDeUrlStorage(url: string): string | null {
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
