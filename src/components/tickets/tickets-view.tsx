"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { TicketsTable } from "@/components/tickets/tickets-table";
import { TicketsKanban } from "@/components/tickets/tickets-kanban";
import { ABOGADOS } from "@/lib/data/abogados";
import { ESTATUS_VALUES, type Estatus, type Ticket } from "@/types/ticket";
import { cn } from "@/lib/utils";

type Vista = "tabla" | "kanban";

const SIN_ASIGNAR = "__sin_asignar__";

export function TicketsView({ tickets }: { tickets: Ticket[] }) {
  const [vista, setVista] = useState<Vista>("tabla");
  const [estatusFiltro, setEstatusFiltro] = useState<Estatus | null>(null);
  const [abogadoFiltro, setAbogadoFiltro] = useState<string>("");

  const conteos = useMemo(() => {
    const map = new Map<Estatus, number>();
    ESTATUS_VALUES.forEach((e) => map.set(e, 0));
    tickets.forEach((t) => map.set(t.estatus, (map.get(t.estatus) ?? 0) + 1));
    return map;
  }, [tickets]);

  const ticketsFiltrados = tickets
    .filter((t) => !estatusFiltro || t.estatus === estatusFiltro)
    .filter((t) => {
      if (!abogadoFiltro) return true;
      if (abogadoFiltro === SIN_ASIGNAR) return !t.abogadoAsignadoId;
      return t.abogadoAsignadoId === abogadoFiltro;
    });

  return (
    <div className="space-y-4">
      {/* Filtro rapido por etapa — aplica igual a la tabla y al kanban */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setEstatusFiltro(null)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
            estatusFiltro === null ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface"
          )}
        >
          Todos ({tickets.length})
        </button>
        {ESTATUS_VALUES.map((estatus) => (
          <button
            key={estatus}
            type="button"
            onClick={() => setEstatusFiltro(estatus === estatusFiltro ? null : estatus)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              estatusFiltro === estatus ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface"
            )}
          >
            {estatus} ({conteos.get(estatus) ?? 0})
          </button>
        ))}
      </div>

      {/* Filtro por abogado asignado — misma idea, tambien aplica a ambas vistas */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium opacity-60">Abogado:</label>
        <select
          value={abogadoFiltro}
          onChange={(e) => setAbogadoFiltro(e.target.value)}
          className="h-8 px-2.5 rounded-md border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos</option>
          <option value={SIN_ASIGNAR}>Sin asignar</option>
          {ABOGADOS.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </div>

      {/* Tabs de vista */}
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setVista("tabla")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            vista === "tabla" ? "border-primary text-primary" : "border-transparent opacity-60 hover:opacity-100"
          )}
        >
          <Table2 className="h-3.5 w-3.5" />
          Tabla
        </button>
        <button
          type="button"
          onClick={() => setVista("kanban")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            vista === "kanban" ? "border-primary text-primary" : "border-transparent opacity-60 hover:opacity-100"
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Kanban
        </button>
      </div>

      {vista === "tabla" ? <TicketsTable tickets={ticketsFiltrados} /> : <TicketsKanban tickets={ticketsFiltrados} />}
    </div>
  );
}
