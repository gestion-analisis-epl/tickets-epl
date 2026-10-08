import { firestoreResumenContratoRepository as repo } from "@/infrastructure/firestore/resumen-contrato-repository";
import type { ResumenContrato } from "@/types/resumen-contrato";

export const subscribeResumenes = repo.subscribeMany;
export const subscribeResumen = repo.subscribeOne;

export async function registrarVistoBueno(ticketId: string, usuario: { uid: string; nombre: string }): Promise<void> {
  await repo.registrarVistoBueno(ticketId, { uid: usuario.uid, nombre: usuario.nombre, fecha: new Date().toISOString() });
}
export type { ResumenContrato };
