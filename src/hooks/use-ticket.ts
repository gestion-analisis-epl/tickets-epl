"use client";

import { useEffect, useState } from "react";
import { subscribeTicket } from "@/lib/tickets";
import { withLiveDerivedFields } from "@/lib/ticket-derived";
import type { Ticket } from "@/types/ticket";

// Con id null no se suscribe a nada (modo ejemplo).
export function useTicket(id: string | null) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (id === null) return;
    setLoading(true);
    setForbidden(false);
    const unsubscribe = subscribeTicket(
      id,
      (t) => {
        setTicket(t ? withLiveDerivedFields(t) : null);
        setLoading(false);
      },
      (err) => {
        if (err.code === "permission-denied") setForbidden(true);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [id]);

  return { ticket, loading, forbidden };
}
