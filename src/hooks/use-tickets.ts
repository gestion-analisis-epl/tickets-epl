"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { subscribeTickets } from "@/lib/tickets";
import { withLiveDerivedFields } from "@/lib/ticket-derived";
import { enPipeline } from "@/domain/tickets/pipeline-rules";
import { ticketsDeEquipo } from "@/domain/tickets/visibilidad-rules";
import type { Ticket } from "@/types/ticket";

// Por defecto no incluye los tickets excluidos del pipeline; solo Mantenimiento los necesita.
export function useTickets({ incluirExcluidos = false }: { incluirExcluidos?: boolean } = {}) {
  const uid = useAuthStore((s) => s.uid);
  const roleEfectivo = useAuthStore((s) => s.role);
  const roleReal = useAuthStore((s) => s.roleReal);
  const verComoGerente = useAuthStore((s) => s.verComoGerente);
  const supervisaUids = useAuthStore((s) => s.supervisaUids);
  // Con "Ver como" gerente se consulta como admin (todo) y se filtra en pantalla el equipo del gerente elegido.
  const simulaGerente = roleEfectivo === "gerente_area" || roleEfectivo === "gerente_sitios";
  const role = simulaGerente ? roleReal : roleEfectivo;
  const equipoKey = simulaGerente ? `${verComoGerente?.uid ?? ""}:${(verComoGerente?.supervisaUids ?? []).join(",")}` : "";
  const status = useAuthStore((s) => s.status);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // La lista cambia de identidad en cada render; se compara por contenido.
  const supervisaKey = supervisaUids.join(",");

  useEffect(() => {
    if (status !== "signed-in" || !uid) return;
    const unsubscribe = subscribeTickets({ uid, role, supervisaUids: supervisaKey ? supervisaKey.split(",") : [] }, (data) => {
      const visibles = simulaGerente ? (verComoGerente ? ticketsDeEquipo(data, verComoGerente) : []) : data;
      setTickets((incluirExcluidos ? visibles : enPipeline(visibles)).map(withLiveDerivedFields));
      setLoading(false);
    });
    return unsubscribe;
    // verComoGerente se compara por contenido (equipoKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, role, supervisaKey, status, incluirExcluidos, simulaGerente, equipoKey]);

  return { tickets, loading };
}
