"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { subscribeTickets } from "@/lib/tickets";
import { withLiveDerivedFields } from "@/lib/ticket-derived";
import type { Ticket } from "@/types/ticket";

export function useTickets() {
  const uid = useAuthStore((s) => s.uid);
  const role = useAuthStore((s) => s.role);
  const status = useAuthStore((s) => s.status);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "signed-in" || !uid) return;
    const unsubscribe = subscribeTickets({ uid, role }, (data) => {
      setTickets(data.map(withLiveDerivedFields));
      setLoading(false);
    });
    return unsubscribe;
  }, [uid, role, status]);

  return { tickets, loading };
}
