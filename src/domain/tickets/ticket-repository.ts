import type { Ticket } from "@/types/ticket";
import type { Role } from "@/types/user";
import type { EntradaHistorial } from "@/types/historial";
import type { RegistroArchivo } from "@/types/archivo";

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
// Los registros de archivos viajan en la misma transaccion: o se guarda el ticket con ellos o nada.
export interface TicketRepository {
  create(build: NewTicketBuilder, archivos?: RegistroArchivo[]): Promise<{ id: string; folio: string }>;
  getById(id: string): Promise<Ticket | null>;
  getByFolio(folio: string): Promise<Ticket | null>;
  update(id: string, patch: Partial<Ticket>): Promise<void>;
  // Ticket, entradas de historial y registros de archivos en un solo lote: o se guardan todos o ninguno.
  updateConHistorial(id: string, patch: Partial<Ticket>, entradas: EntradaHistorial[], archivos?: RegistroArchivo[]): Promise<void>;
  // Solo entradas de historial (tras crear un ticket, cuando el ticket ya existe para las reglas).
  agregarHistorial(id: string, entradas: EntradaHistorial[]): Promise<void>;
  delete(id: string): Promise<void>;
  listCerrados(): Promise<Ticket[]>;
  subscribeMany(filter: { uid: string; role: Role; supervisaUids?: string[] }, callback: (tickets: Ticket[]) => void): Unsubscribe;
  subscribeOne(id: string, callback: (ticket: Ticket | null) => void, onError?: (err: RepositoryError) => void): Unsubscribe;
}
