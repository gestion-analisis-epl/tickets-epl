import { useEffect, useState } from "react";
import { guardarSesion, leerSesion } from "@/lib/session-storage";

// Como useState, pero el valor sobrevive a navegar y volver dentro de la sesion de la
// pestana. Se lee al montar: solo usar en componentes que se renderizan ya en el cliente.
export function useSessionStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => leerSesion(key, initialValue));

  useEffect(() => {
    guardarSesion(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
