"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { ETAPAS_EJEMPLO, ID_TICKET_EJEMPLO, SERVICIOS_EJEMPLO, ticketEjemplo } from "@/domain/tickets/ticket-ejemplo";

// Guia del abogado: ticket ficticio de Alta de arrendador en la etapa elegida en "Ver como".
export default function TicketEjemploPage() {
  const verComo = useAuthStore((s) => s.verComo);
  const etapa = useAuthStore((s) => s.etapaEjemplo);
  const servicioId = useAuthStore((s) => s.servicioEjemplo);
  const ticket = useMemo(() => (etapa ? ticketEjemplo(etapa, servicioId) : null), [etapa, servicioId]);

  if (verComo !== "abogado" || !etapa || !ticket) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-2 text-sm">
        <p>Para ver el ejemplo, elige &quot;Ver como&quot; Abogado y una etapa en &quot;Ejemplo de ticket&quot;.</p>
        <Link href="/tickets" className="text-primary hover:underline">Volver a Tickets</Link>
      </div>
    );
  }

  const etiqueta = ETAPAS_EJEMPLO.find((e) => e.etapa === etapa)?.etiqueta ?? etapa;
  const servicio = SERVICIOS_EJEMPLO.find((s) => s.servicioId === servicioId)?.etiqueta ?? servicioId;
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div role="status" className="rounded-md border border-border bg-surface p-3 text-sm">
        <p className="font-medium">Ejemplo: {etiqueta} ({servicio})</p>
        <p className="text-muted">Datos ficticios para la guía. Puedes llenar y probar todo, pero no se guarda nada en el sistema.</p>
      </div>
      <TicketDetail key={`${etapa}-${servicioId}`} id={ID_TICKET_EJEMPLO} ejemplo={ticket} />
    </div>
  );
}
