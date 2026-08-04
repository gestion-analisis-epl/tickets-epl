import type { Role } from "@/types/user";

export interface UserDoc {
  nombre: string;
  email: string;
  role: Role;
  activo: boolean;
  abogadoId?: string; // liga a Abogado.id (data/abogados.ts) — ver notificacion-service.ts notificarAsignacion
}

export interface UserRow extends UserDoc {
  uid: string;
}
