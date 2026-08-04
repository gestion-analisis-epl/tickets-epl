import type { Role } from "@/types/user";
import type { Notificacion, NuevaNotificacionInput } from "./notificacion";

export type Unsubscribe = () => void;

export interface NotificacionRepository {
  crear(input: NuevaNotificacionInput): Promise<void>;
  subscribeMany(filter: { uid: string; role: Role }, callback: (notifs: Notificacion[]) => void): Unsubscribe;
  marcarLeida(id: string, uid: string): Promise<void>;
  findUidPorAbogado(abogadoId: string): Promise<string | null>;
}
