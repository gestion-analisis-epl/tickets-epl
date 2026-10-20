"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { subscribeHistorial } from "@/lib/historial";
import type { EntradaHistorialGuardada } from "@/types/historial";

// Solo montar donde puedeVerHistorial() o el solicitante dueno (soloVisibleSolicitante) lo permitan:
// para los demas las reglas niegan la lectura.
export function useHistorial(ticketId: string, soloVisibleSolicitante = false) {
  const status = useAuthStore((s) => s.status);
  const [entradas, setEntradas] = useState<EntradaHistorialGuardada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== "signed-in") return;
    setLoading(true);
    setError(false);
    return subscribeHistorial(
      ticketId,
      (data) => {
        setEntradas(data);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      },
      { soloVisibleSolicitante }
    );
  }, [ticketId, status, soloVisibleSolicitante]);

  return { entradas, loading, error };
}
