import type { Role } from "@/types/user";
import type { NotificacionRepository } from "./notificacion-repository";
import type { Notificacion, NuevaNotificacionInput } from "./notificacion";

export function createNotificacionService(repo: NotificacionRepository) {
  async function crearNotificacion(input: NuevaNotificacionInput): Promise<void> {
    await repo.crear(input);
  }

  // abogadoAsignadoId es un id del catalogo, no un uid — se busca la cuenta enlazada.
  async function notificarAsignacion(ticketId: string, ticketFolio: string, abogadoId: string): Promise<void> {
    const uid = await repo.findUidPorAbogado(abogadoId);
    if (!uid) return;
    await repo.crear({
      ticketId, ticketFolio, tipo: "asignacion",
      mensaje: `Te asignaron el ticket ${ticketFolio}.`,
      paraUid: uid, paraRoles: null,
    });
  }

  function subscribeNotificaciones(filter: { uid: string; role: Role }, callback: (notifs: Notificacion[]) => void) {
    return repo.subscribeMany(filter, callback);
  }

  async function marcarLeida(id: string, uid: string): Promise<void> {
    await repo.marcarLeida(id, uid);
  }

  async function marcarTodasLeidas(notifs: Notificacion[], uid: string): Promise<void> {
    await Promise.all(notifs.map((n) => repo.marcarLeida(n.id, uid).catch(() => {})));
  }

  return { crearNotificacion, notificarAsignacion, subscribeNotificaciones, marcarLeida, marcarTodasLeidas };
}
