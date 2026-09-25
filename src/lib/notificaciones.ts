import { auth } from "./firebase";
import { firestoreNotificacionRepository } from "@/infrastructure/firestore/notificacion-repository";
import { createNotificacionService } from "@/domain/notificaciones/notificacion-service";
import type { TipoNotificacion } from "@/domain/notificaciones/notificacion";

export type { TipoNotificacion, Notificacion, NuevaNotificacionInput } from "@/domain/notificaciones/notificacion";

const notificacionService = createNotificacionService(firestoreNotificacionRepository);

export const crearNotificacion = notificacionService.crearNotificacion;
export const notificarAsignacion = notificacionService.notificarAsignacion;
export const notificarReasignacion = notificacionService.notificarReasignacion;
export const subscribeNotificaciones = notificacionService.subscribeNotificaciones;
export const marcarLeida = notificacionService.marcarLeida;
export const marcarTodasLeidas = notificacionService.marcarTodasLeidas;

export interface EnviarEmailNotificacionInput {
  tipo: TipoNotificacion;
  mensaje: string;
  ticketId: string;
  ticketFolio: string;
  tokenCalificacion?: string; // solo tipo "cierre" — habilita el link de calificar sin login
}

// Best-effort: la ruta calcula el destinatario real segun tipo (ver route.ts).
export async function enviarEmailNotificacion(input: EnviarEmailNotificacionInput): Promise<void> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) return;
  await fetch("/api/notificaciones/email", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => {});
}
