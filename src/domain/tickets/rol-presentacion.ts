import type { Role } from "@/types/user";

// Cada rol tiene su color (tokens --rol-* en globals.css) para distinguir quien hizo cada cambio.
export const ETIQUETA_ROL: Record<Role, string> = {
  solicitante: "Solicitante",
  gerente_area: "Gerente de área",
  mesa_control: "Mesa de Control",
  abogado: "Abogado",
  gerente_juridico: "Gerente Jurídico",
  admin: "Administrador",
  jefe_zona: "Jefe de zona",
  sitios: "Sitios",
};

export function etiquetaRol(rol: string): string {
  return ETIQUETA_ROL[rol as Role] ?? rol;
}

// Nombre del token CSS (sin "--"); los roles desconocidos usan el gris neutro.
export function tokenColorRol(rol: string): string {
  return rol in ETIQUETA_ROL ? `rol-${rol.replace(/_/g, "-")}` : "rol-otro";
}
