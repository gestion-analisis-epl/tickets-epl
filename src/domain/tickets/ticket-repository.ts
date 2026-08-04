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

// Puerto que el dominio de tickets usa para persistir/consultar — sin
// mencionar Firestore. create() recibe un builder en vez del ticket ya armado
// porque el folio (JUR-0001...) solo se conoce dentro de la transaccion que
// lo genera; la implementacion decide como se garantiza esa atomicidad.
export interface TicketRepository {
  create(build: NewTicketBuilder): Promise<{ id: string; folio: string }>;
  getById(id: string): Promise<Ticket | null>;
  update(id: string, patch: Partial<Ticket>): Promise<void>;
  delete(id: string): Promise<void>;
  listCerrados(): Promise<Ticket[]>;
  subscribeMany(filter: { uid: string; role: Role }, callback: (tickets: Ticket[]) => void): Unsubscribe;
  subscribeOne(id: string, callback: (ticket: Ticket | null) => void, onError?: (err: RepositoryError) => void): Unsubscribe;
}
