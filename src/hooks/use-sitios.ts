"use client";

import { useCallback, useEffect, useState } from "react";
import { leerSitios } from "@/lib/sitios";
import type { Sitio } from "@/domain/sitios/sitios-rules";

export function useSitios() {
  const [sitios, setSitios] = useState<Sitio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desactualizado, setDesactualizado] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    // El primer intento usa la copia de la sesion; "Reintentar" fuerza una carga nueva.
    leerSitios({ forzar: intento > 0 })
      .then((r) => {
        if (cancelado) return;
        setSitios(r.sitios);
        setDesactualizado(r.desactualizado);
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : "No se pudo cargar el catalogo de sitios.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  return { sitios, loading, error, desactualizado, reintentar };
}
