import type { Role } from "@/types/user";
import type { TipoNotificacion } from "@/domain/notificaciones/notificacion";
import type { AjustesPermisos } from "./permisos";

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
  // Avisos de gestion extra que el admin le activo aunque su rol no los reciba (ver preferencias-rules.ts).
  correosAdicionales?: TipoNotificacion[];
  // Excepciones a los permisos de su rol (ver permisos.ts). Solo las fija quien gestiona usuarios.
  permisos?: AjustesPermisos;
}

export interface UserRow extends UserDoc {
  uid: string;
}
