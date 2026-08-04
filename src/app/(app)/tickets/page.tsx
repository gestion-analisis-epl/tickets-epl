"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketsView } from "@/components/tickets/tickets-view";
import { useTickets } from "@/hooks/use-tickets";

export default function TicketsPage() {
  const { tickets, loading } = useTickets();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Tickets</h1>
          <p className="text-sm mt-1 opacity-70">Todas las solicitudes del area Legal, en tabla o por etapa.</p>
        </div>
        <Link href="/tickets/nuevo">
          <Button variant="primary">Nuevo ticket</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-5 w-5 animate-spin opacity-50" />
        </div>
      ) : (
        <TicketsView tickets={tickets} />
      )}
    </div>
  );
}
