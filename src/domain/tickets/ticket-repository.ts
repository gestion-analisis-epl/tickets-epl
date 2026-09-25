import type { Ticket } from "@/types/ticket";
import type { Role } from "@/types/user";

export type Unsubscribe = () => void;

export interface RepositoryError {
  code: string;
}

export interface NewTicketResult {
  ticket: Ticket;
  notificacionMensaje: string;
}

export type NewTicketBuilder = (ctx: { id: string; folio: string }) => NewTicketResult;

// create() recibe un builder porque el folio solo se conoce dentro de la transaccion que lo genera.
export interface TicketRepository {
  create(build: NewTicketBuilder): Promise<{ id: string; folio: string }>;
  getById(id: string): Promise<Ticket | null>;
  getByFolio(folio: string): Promise<Ticket | null>;
  update(id: string, patch: Partial<Ticket>): Promise<void>;
  delete(id: string): Promise<void>;
  listCerrados(): Promise<Ticket[]>;
  subscribeMany(filter: { uid: string; role: Role }, callback: (tickets: Ticket[]) => void): Unsubscribe;
  subscribeOne(id: string, callback: (ticket: Ticket | null) => void, onError?: (err: RepositoryError) => void): Unsubscribe;
}
