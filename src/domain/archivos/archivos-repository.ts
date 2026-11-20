import type { RegistroArchivoGuardado } from "@/types/archivo";
import type { RepositoryError, Unsubscribe } from "@/domain/tickets/ticket-repository";

export interface ArchivosRepository {
  subscribe(
    ticketId: string,
    callback: (registros: RegistroArchivoGuardado[]) => void,
    onError?: (err: RepositoryError) => void
  ): Unsubscribe;
}
