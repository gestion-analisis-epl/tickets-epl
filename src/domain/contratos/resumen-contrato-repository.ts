import type { Estatus } from "@/types/ticket";
import type { ResumenContrato, VistoBueno } from "@/types/resumen-contrato";
import type { RepositoryError } from "@/domain/tickets/ticket-repository";

export interface ResumenContratoRepository {
  get(ticketId: string): Promise<ResumenContrato | null>;
  upsert(resumen: ResumenContrato): Promise<void>;
  updateEstatus(ticketId: string, estatus: Estatus, actualizadoEn: string): Promise<void>;
  // Solo etapas visibles para el jefe de zona (las reglas de Firestore exigen ese filtro).
  subscribeMany(callback: (resumenes: ResumenContrato[]) => void, onError?: (e: RepositoryError) => void): () => void;
  subscribeOne(
    ticketId: string,
    callback: (resumen: ResumenContrato | null) => void,
    onError?: (e: RepositoryError) => void
  ): () => void;
  delete(ticketId: string): Promise<void>;
  registrarVistoBueno(ticketId: string, visto: VistoBueno): Promise<void>;
}
