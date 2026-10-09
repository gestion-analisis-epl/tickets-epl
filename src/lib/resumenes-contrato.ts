import { firestoreResumenContratoRepository as repo } from "@/infrastructure/firestore/resumen-contrato-repository";
import { prepararVistoBueno } from "@/domain/contratos/visto-bueno-rules";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { ActorHistorial } from "@/types/historial";

export const subscribeResumenes = repo.subscribeMany;
export const subscribeResumenesTodos = repo.subscribeTodos;
export const subscribeResumen = repo.subscribeOne;

export async function registrarVistoBueno(ticketId: string, actor: ActorHistorial): Promise<void> {
  const { visto, entrada } = prepararVistoBueno(actor, new Date());
  await repo.registrarVistoBueno(ticketId, visto, entrada);
}
export type { ResumenContrato };
