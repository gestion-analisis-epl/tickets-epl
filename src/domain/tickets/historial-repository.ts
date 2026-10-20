import type { EntradaHistorialGuardada } from "@/types/historial";
import type { RepositoryError, Unsubscribe } from "./ticket-repository";

// Solo lectura: las entradas se escriben dentro de los lotes de cada cambio (ver updateConHistorial).
export interface HistorialRepository {
  subscribe(
    ticketId: string,
    callback: (entradas: EntradaHistorialGuardada[]) => void,
    onError?: (e: RepositoryError) => void,
    // Vista del solicitante dueno: solo entradas visibleSolicitante (las reglas exigen el filtro).
    opciones?: { soloVisibleSolicitante?: boolean }
  ): Unsubscribe;
}
