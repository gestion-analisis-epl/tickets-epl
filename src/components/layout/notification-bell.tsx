"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox, UserCheck, ArrowRightCircle, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useNotificaciones } from "@/hooks/use-notificaciones";
import { marcarLeida, marcarTodasLeidas, type Notificacion, type TipoNotificacion } from "@/lib/notificaciones";
import { formatFecha } from "@/lib/format-fecha";
import { cn } from "@/lib/utils";

const TIPO_LABEL: Record<TipoNotificacion, string> = {
  nuevo_ticket: "Nuevo ticket",
  asignacion: "Asignacion",
  cambio_estatus: "Cambio de estatus",
  cierre: "Cierre",
  creacion_solicitante: "Ticket creado",
  asignacion_solicitante: "Responsable asignado",
};

const TIPO_ICON: Record<TipoNotificacion, React.ElementType> = {
  nuevo_ticket: Inbox,
  asignacion: UserCheck,
  cambio_estatus: ArrowRightCircle,
  cierre: CheckCircle2,
  creacion_solicitante: Inbox,
  asignacion_solicitante: UserCheck,
};

const TIPO_TONE: Record<TipoNotificacion, string> = {
  nuevo_ticket: "text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20",
  asignacion: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/10 dark:border-indigo-500/20",
  cambio_estatus: "text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20",
  cierre: "text-success bg-success/10 border-success/20",
  creacion_solicitante: "text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20",
  asignacion_solicitante: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/10 dark:border-indigo-500/20",
};

// Panel tipo navbar (absolute, sin portal) — a diferencia de un menu dentro
// del sidebar colapsable, aqui no hay overflow-hidden que lo recorte.
export function NotificationBell() {
  const uid = useAuthStore((s) => s.uid);
  const router = useRouter();
  const { notificaciones } = useNotificaciones();
  const [open, setOpen] = useState(false);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const noLeidas = uid ? notificaciones.filter((n) => !n.leidoPor.includes(uid)) : [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleClickNotif(n: Notificacion) {
    if (uid && !n.leidoPor.includes(uid)) marcarLeida(n.id, uid).catch(() => {});
    setOpen(false);
    router.push(`/tickets/${n.ticketId}`);
  }

  async function handleMarcarTodas() {
    if (!uid || marcandoTodas) return;
    setMarcandoTodas(true);
    try {
      await marcarTodasLeidas(noLeidas, uid);
    } finally {
      setMarcandoTodas(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Notificaciones"
        className="relative p-2 rounded-lg text-foreground/60 hover:text-foreground hover:bg-surface transition-colors"
      >
        <Bell className="h-5 w-5" />
        {noLeidas.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-danger-foreground text-[9px] font-bold leading-none">
            {noLeidas.length > 9 ? "9+" : noLeidas.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-96 bg-card text-card-foreground rounded-xl border border-border shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 opacity-60" />
              <span className="text-sm font-semibold">Notificaciones</span>
              {noLeidas.length > 0 && (
                <span className="text-[10px] font-bold rounded-full bg-danger/15 text-danger px-1.5 py-0.5">
                  {noLeidas.length} nueva{noLeidas.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {noLeidas.length > 0 && (
              <button
                type="button"
                onClick={handleMarcarTodas}
                disabled={marcandoTodas}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Todas leidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
                <Bell className="h-8 w-8" />
                <p className="text-sm">Sin notificaciones</p>
              </div>
            ) : (
              notificaciones.map((n) => {
                const noLeida = !!uid && !n.leidoPor.includes(uid);
                const Icon = TIPO_ICON[n.tipo];
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClickNotif(n)}
                    className={cn(
                      "flex gap-3 w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors hover:bg-surface",
                      !noLeida && "opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", TIPO_TONE[n.tipo])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{TIPO_LABEL[n.tipo]}</span>
                        {noLeida && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-sm mt-0.5">{n.mensaje}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] opacity-50 tabular-nums">{n.ticketFolio}</span>
                        <span className="text-[11px] opacity-40">{formatFecha(n.fecha, { conHora: true })}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
