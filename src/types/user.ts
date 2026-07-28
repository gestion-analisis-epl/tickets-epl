export type Role = "solicitante" | "mesa_control" | "abogado" | "gerente_juridico" | "admin";

export interface AppUser {
  uid: string;
  nombre: string;
  email: string;
  role: Role;
  areaEmpresa?: string; // solo aplica a solicitantes
  activo: boolean;
}
