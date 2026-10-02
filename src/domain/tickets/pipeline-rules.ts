import type { Ticket } from "@/types/ticket";

// Tickets de prueba o sacados a mano (Configuracion → Mantenimiento) no cuentan en la
// tabla, el kanban ni el dashboard. No se borran: la marca se puede revertir.
export function enPipeline(tickets: Ticket[]): Ticket[] {
  return tickets.filter((t) => !t.excluidoDelPipeline);
}
