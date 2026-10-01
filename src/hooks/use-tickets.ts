"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { subscribeTickets } from "@/lib/tickets";
import { withLiveDerivedFields } from "@/lib/ticket-derived";
import type { Ticket } from "@/types/ticket";

export function useTickets() {
  const uid = useAuthStore((s) => s.uid);
  const role = useAuthStore((s) => s.role);
  const supervisaUids = useAuthStore((s) => s.supervisaUids);
  const status = useAuthStore((s) => s.status);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // La lista cambia de identidad en cada render; se compara por contenido.
  const supervisaKey = supervisaUids.join(",");

  useEffect(() => {
    if (status !== "signed-in" || !uid) return;
    const unsubscribe = subscribeTickets({ uid, role, supervisaUids: supervisaKey ? supervisaKey.split(",") : [] }, (data) => {
      setTickets(data.map(withLiveDerivedFields));
      setLoading(false);
    });
    return unsubscribe;
  }, [uid, role, supervisaKey, status]);

  return { tickets, loading };
}
