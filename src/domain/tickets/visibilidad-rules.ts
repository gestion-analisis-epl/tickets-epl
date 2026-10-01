import { isSolicitanteRole, puedeSupervisar, type Role } from "@/types/user";
import type { Ticket } from "@/types/ticket";

// Uids cuyos tickets consulta el usuario, uno por consulta (las reglas de Firestore solo aprueban
// una consulta si cada filtro se puede comprobar). null = todos (staff de Legal / admin).
export function uidsConsultaTickets(filtro: { uid: string; role: Role; supervisaUids?: string[] }): string[] | null {
  if (!isSolicitanteRole(filtro.role)) return null;
  const supervisados = puedeSupervisar(filtro.role) ? (filtro.supervisaUids ?? []) : [];
  return Array.from(new Set([filtro.uid, ...supervisados].filter(Boolean)));
}

// Junta los resultados de varias consultas: sin repetidos, del mas reciente al mas antiguo.
export function combinarTickets(listas: Ticket[][]): Ticket[] {
  const porId = new Map<string, Ticket>();
  for (const lista of listas) for (const t of lista) porId.set(t.id, t);
  return Array.from(porId.values()).sort((a, b) => (a.fechaSolicitud < b.fechaSolicitud ? 1 : -1));
}
