"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { subscribeResumenes, subscribeResumenesTodos, subscribeResumen } from "@/lib/resumenes-contrato";
import { ordenarResumenesJefeZona } from "@/domain/contratos/resumen-presentacion";
import { esJefeZona } from "@/types/user";
import type { ResumenContrato } from "@/types/resumen-contrato";

export function useResumenes() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.role);
  const [resumenes, setResumenes] = useState<ResumenContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"permission-denied" | "unknown" | null>(null);

  useEffect(() => {
    if (status !== "signed-in") return;
    setError(null);
    // Jefe de zona: todos sus resumenes (incluidos los en correccion). Cualquier otro rol (p. ej. sitios):
    // la consulta filtrada por Pre-Cierre/Cierre que exigen sus reglas.
    const suscribir = esJefeZona(role) ? subscribeResumenesTodos : subscribeResumenes;
    const unsubscribe = suscribir(
      (data) => {
        setResumenes(ordenarResumenesJefeZona(data));
        setLoading(false);
      },
      (err) => {
        setError(err.code === "permission-denied" ? "permission-denied" : "unknown");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [status, role]);

  return { resumenes, loading, error };
}

export function useResumen(id: string) {
  const status = useAuthStore((s) => s.status);
  const [resumen, setResumen] = useState<ResumenContrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (status !== "signed-in") return;
    setLoading(true);
    setForbidden(false);
    const unsubscribe = subscribeResumen(
      id,
      (r) => {
        setResumen(r);
        setLoading(false);
      },
      (err) => {
        if (err.code === "permission-denied") setForbidden(true);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [id, status]);

  return { resumen, loading, forbidden };
}
