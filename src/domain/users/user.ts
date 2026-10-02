import type { Role } from "@/types/user";
import type { TipoNotificacion } from "@/domain/notificaciones/notificacion";

export interface UserDoc {
  nombre: string;
  email: string;
  role: Role;
  activo: boolean;
  abogadoId?: string; // liga a Abogado.id (data/abogados.ts) — ver notificacion-service.ts notificarAsignacion
  // Solo gerente_area: uids de los usuarios cuyos tickets puede ver (sin editarlos). Sincronizar con firestore.rules.
  supervisaUids?: string[];
  // Correos que el admin apago para este usuario (ver notificaciones/preferencias-rules.ts). Sin definir = recibe todos los de su rol.
  correosDesactivados?: TipoNotificacion[];
}

export interface UserRow extends UserDoc {
  uid: string;
}
