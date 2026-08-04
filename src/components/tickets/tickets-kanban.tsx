"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, useDraggable, useDroppable, DragOverlay,
  PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { updateTicketAsignacion } from "@/lib/tickets";
import { findServicio } from "@/lib/catalogo";
import { ESTATUS_VALUES, type Estatus, type Ticket } from "@/types/ticket";
import { Badge, ESTATUS_TONE, TONE_SURFACE_CLASSES, CategoriaBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function TicketCardBody({ ticket }: { ticket: Ticket }) {
  const servicio = findServicio(ticket.servicioId);
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tabular-nums opacity-60">{ticket.folio}</span>
        <CategoriaBadge categoria={ticket.categoria} />
      </div>
      <p className="text-sm font-medium mt-1.5 truncate" title={servicio?.servicio}>
        {servicio?.servicio ?? ticket.servicioId}
      </p>
      <p className="text-xs opacity-60 mt-0.5 truncate">{ticket.solicitanteNombre}</p>
      <div className="flex items-center justify-between mt-2 text-xs gap-2">
        <span className="opacity-60 truncate">{ticket.abogadoAsignadoId ?? "Sin asignar"}</span>
        {ticket.nivelServicio != null && (
          <span className={cn("font-medium tabular-nums shrink-0", ticket.nivelServicio < 0 ? "text-danger" : "text-success")}>
            {ticket.nivelServicio > 0 ? `+${ticket.nivelServicio}` : ticket.nivelServicio}
          </span>
        )}
      </div>
    </>
  );
}

function TicketCard({ ticket, canDrag, moving }: { ticket: Ticket; canDrag: boolean; moving: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
    disabled: !canDrag || moving,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(canDrag ? listeners : {})}
      // Navega al detalle en clic/Enter. NO se usa <Link> aqui a proposito:
      // un <a> dentro de un elemento arrastrable choca con el "arrastrar
      // este link" nativo del navegador, que corta la secuencia de eventos
      // de puntero antes de que dnd-kit alcance a detectar el arrastre.
      // Se ponen DESPUES de los spreads para que nunca los sobreescriban.
      onClick={() => { if (!isDragging) router.push(`/tickets/${ticket.id}`); }}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/tickets/${ticket.id}`); }}
      className={cn(
        "relative block rounded-md border border-border bg-card p-3 cursor-pointer select-none touch-none",
        "hover:border-primary/40 hover:bg-surface/60 transition-colors",
        isDragging && "opacity-40",
        moving && "opacity-60 pointer-events-none"
      )}
    >
      <TicketCardBody ticket={ticket} />
      {moving && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/60 rounded-md">
          <Loader2 className="h-4 w-4 animate-spin opacity-70" />
        </div>
      )}
    </div>
  );
}

// Tope de tarjetas visibles antes de que la columna haga scroll vertical, en
// vez de crecer sin limite. ~112px por tarjeta (padding + contenido + el gap
// de space-y-2) — si el alto real de las tarjetas cambia, ajustar aqui.
const TARJETAS_VISIBLES_MAX = 6;
const ALTURA_TARJETA_PX = 112;

function Column({
  estatus, items, canDrag, movingIds,
}: {
  estatus: Estatus; items: Ticket[]; canDrag: boolean; movingIds: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estatus });
  const tone = ESTATUS_TONE[estatus] ?? "gray";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-72 shrink-0 rounded-lg border transition-colors",
        TONE_SURFACE_CLASSES[tone],
        isOver && "ring-2 ring-primary"
      )}
    >
      <div className="px-3 py-2.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
        <Badge tone={tone}>{estatus}</Badge>
        <span className="text-xs tabular-nums opacity-50 shrink-0">{items.length}</span>
      </div>
      <div
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]"
        style={{ maxHeight: TARJETAS_VISIBLES_MAX * ALTURA_TARJETA_PX }}
      >
        {items.length === 0 ? (
          <p className="text-xs opacity-40 text-center py-6">Sin tickets</p>
        ) : (
          items.map((t) => <TicketCard key={t.id} ticket={t} canDrag={canDrag} moving={movingIds.has(t.id)} />)
        )}
      </div>
    </div>
  );
}

export function TicketsKanban({ tickets }: { tickets: Ticket[] }) {
  const { uid, role } = useAuthStore();
  const canDrag = role === "mesa_control" || role === "abogado" || role === "gerente_juridico" || role === "admin";

  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());
  const [dragError, setDragError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveTicket((event.active.data.current?.ticket as Ticket | undefined) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    const ticket = active.data.current?.ticket as Ticket | undefined;
    const nuevoEstatus = over.id as Estatus;
    if (!ticket || nuevoEstatus === ticket.estatus || !uid) return;

    setDragError(null);
    setMovingIds((prev) => new Set(prev).add(ticket.id));
    try {
      await updateTicketAsignacion(ticket.id, uid, {
        estatus: nuevoEstatus,
        abogadoAsignadoId: ticket.abogadoAsignadoId,
        notasCierre: ticket.notasCierre,
      });
    } catch {
      setDragError(`No se pudo mover ${ticket.folio}. Intenta de nuevo.`);
    } finally {
      setMovingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-2">
      {dragError && <p className="text-sm text-danger">{dragError}</p>}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ESTATUS_VALUES.map((estatus) => (
            <Column
              key={estatus}
              estatus={estatus}
              items={tickets.filter((t) => t.estatus === estatus)}
              canDrag={canDrag}
              movingIds={movingIds}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTicket && (
            <div className="w-72 rounded-md border border-primary bg-card p-3 shadow-lg">
              <TicketCardBody ticket={activeTicket} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
