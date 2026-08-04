import { auth } from "./firebase";
import { firestoreNotificacionRepository } from "@/infrastructure/firestore/notificacion-repository";
import { createNotificacionService } from "@/domain/notificaciones/notificacion-service";
import type { TipoNotificacion } from "@/domain/notificaciones/notificacion";

export type { TipoNotificacion, Notificacion, NuevaNotificacionInput } from "@/domain/notificaciones/notificacion";

const notificacionService = createNotificacionService(firestoreNotificacionRepository);

export const crearNotificacion = notificacionService.crearNotificacion;
export const notificarAsignacion = notificacionService.notificarAsignacion;
export const subscribeNotificaciones = notificacionService.subscribeNotificaciones;
export const marcarLeida = notificacionService.marcarLeida;
export const marcarTodasLeidas = notificacionService.marcarTodasLeidas;

export interface EnviarEmailPruebaInput {
  tipo: TipoNotificacion;
  mensaje: string;
  ticketId: string;
  ticketFolio: string;
  tokenCalificacion?: string; // solo tipo "cierre" — habilita el link de calificar sin login
}

// PRUEBA: redirige todo correo a una direccion fija (ver
// app/api/notificaciones/email/route.ts), sin importar el destinatario real.
// Best-effort — nunca debe bloquear el flujo principal si falla.
export async function enviarEmailPrueba(input: EnviarEmailPruebaInput): Promise<void> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) return;
  await fetch("/api/notificaciones/email", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => {});
}
