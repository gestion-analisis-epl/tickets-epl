// Subconjunto de Storage que necesitamos (sessionStorage en el navegador).
export interface AlmacenSesion {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function almacenDelNavegador(): AlmacenSesion | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined; // acceso bloqueado (modo privado, etc.)
  }
}

export function leerSesion<T>(key: string, inicial: T, almacen: AlmacenSesion | undefined = almacenDelNavegador()): T {
  try {
    const guardado = almacen?.getItem(key);
    return guardado == null ? inicial : (JSON.parse(guardado) as T);
  } catch {
    return inicial;
  }
}

export function guardarSesion(key: string, value: unknown, almacen: AlmacenSesion | undefined = almacenDelNavegador()): void {
  try {
    almacen?.setItem(key, JSON.stringify(value));
  } catch {
    // sin cuota o sin acceso: el estado sigue funcionando en memoria
  }
}
