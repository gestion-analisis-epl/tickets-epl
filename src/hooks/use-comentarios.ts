"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { subscribeComentarios } from "@/lib/conversacion";
import type { Comentario } from "@/types/comentario";

export function useComentarios(ticketId: string) {
  const status = useAuthStore((s) => s.status);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== "signed-in") return;
    setLoading(true);
    setError(false);
    return subscribeComentarios(
      ticketId,
      (data) => {
        setComentarios(data);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );
  }, [ticketId, status]);

  return { comentarios, loading, error };
}
