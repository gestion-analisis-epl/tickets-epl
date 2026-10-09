import type { Estatus } from "@/types/ticket";
import { isAdminRole, isSolicitanteRole, LEGAL_STAFF_ROLES, type Role } from "@/types/user";

// Sincronizar a mano con camposProcesoPreCierre() en firestore.rules.
export const CAMPOS_PROCESO_PRE_CIERRE = [
  "estatus",
  "historialEstatus",
  "abogadoAsignadoId",
  "fechaAsignacion",
  "fechaCompromiso",
  "notasCierre",
  "fechaCierre",
  "diasPipeline",
  "diasHabilesTranscurridos",
  "nivelServicio",
  "tokenCalificacion",
  "conversacionAbiertaEn",
  "excluidoDelPipeline",
  "resumenContrato",
] as const;

// Sincronizar con la regla del solicitante dueno en firestore.rules (tickets, allow update).
export const CAMPOS_SOLICITUD_DUENO = [
  "areaEmpresa",
  "servicioId",
  "descripcion",
  "documentacion",
  "categoria",
  "puestoResponsableSugerido",
  "slaInterno",
  "fechaCompromiso",
] as const;

export const CAMPOS_SATISFACCION = ["satisfaccion", "comentarioSatisfaccion"] as const;

export type CamposPermitidos = { tipo: "todos"; excepto: readonly string[] } | { tipo: "solo"; campos: readonly string[] };

export const MENSAJE_BLOQUEO_PRE_CIERRE =
  "En Pre-Cierre la solicitud, los documentos y el sitio estan bloqueados; las correcciones se piden en la conversacion.";

// Espejo de "allow update" de tickets en firestore.rules. Para solicitante/gerente_area supone que es
// el dueno del ticket (si no lo es, las reglas no le dejan nada).
export function camposPermitidosPorEtapa(estatus: Estatus, rol: Role): CamposPermitidos {
  if (isAdminRole(rol)) {
    return estatus === "Pre-Cierre" ? { tipo: "solo", campos: CAMPOS_PROCESO_PRE_CIERRE } : { tipo: "todos", excepto: [] };
  }
  if (LEGAL_STAFF_ROLES.includes(rol)) {
    // Reasignar abogado es exclusivo de admin/gerente juridico.
    return estatus === "Pre-Cierre"
      ? { tipo: "solo", campos: CAMPOS_PROCESO_PRE_CIERRE.filter((c) => c !== "abogadoAsignadoId") }
      : { tipo: "todos", excepto: ["abogadoAsignadoId"] };
  }
  if (isSolicitanteRole(rol)) {
    if (estatus === "Cierre") return { tipo: "solo", campos: CAMPOS_SATISFACCION };
    if (estatus === "Pre-Cierre") return { tipo: "solo", campos: [] };
    return { tipo: "solo", campos: CAMPOS_SOLICITUD_DUENO };
  }
  return { tipo: "solo", campos: [] };
}

export function puedeModificarCampos(estatus: Estatus, rol: Role, campos: string[]): boolean {
  const permitidos = camposPermitidosPorEtapa(estatus, rol);
  if (permitidos.tipo === "todos") return campos.every((c) => !permitidos.excepto.includes(c));
  return campos.every((c) => permitidos.campos.includes(c));
}

// Area/servicio/descripcion/documentos en pantalla: solo antes de Pre-Cierre.
export function solicitudEditable(estatus: Estatus): boolean {
  return estatus !== "Pre-Cierre" && estatus !== "Cierre";
}

export function bloqueadoPorPreCierre(estatus: Estatus): boolean {
  return estatus === "Pre-Cierre";
}
