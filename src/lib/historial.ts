import { firestoreHistorialRepository as repo } from "@/infrastructure/firestore/historial-repository";

export const subscribeHistorial = repo.subscribe;
export type { EntradaHistorialGuardada } from "@/types/historial";
