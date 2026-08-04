"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { subscribeNotificaciones, type Notificacion } from "@/lib/notificaciones";

export function useNotificaciones() {
  const uid = useAuthStore((s) => s.uid);
  const role = useAuthStore((s) => s.role);
  const status = useAuthStore((s) => s.status);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  useEffect(() => {
    if (status !== "signed-in" || !uid) return;
    return subscribeNotificaciones({ uid, role }, setNotificaciones);
  }, [uid, role, status]);

  return { notificaciones };
}
