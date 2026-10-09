import type { Estatus, HistorialEntry, Ticket } from "@/types/ticket";
import { isAdminRole, type Role } from "@/types/user";
import type { VistoBueno } from "@/types/resumen-contrato";
import type { ActorHistorial, CambioCampo, EntradaHistorial, EntradaHistorialGuardada, TipoHistorial } from "@/types/historial";
import { nombreDeUrl } from "@/domain/contratos/contrato-rules";
import { findAbogado } from "@/lib/data/abogados";

export interface CampoVigilado {
  campo: keyof Ticket;
  etiqueta: string;
  // Convierte el valor guardado en texto legible. Por defecto, textoDeValor.
  formato?: (valor: unknown) => string | null;
}

function esSitio(valor: unknown): valor is { clave: string; alias: string } {
  return typeof valor === "object" && valor !== null && "clave" in valor && "alias" in valor;
}

export function textoDeValor(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "boolean") return valor ? "sí" : "no";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "string") return valor === "" ? null : valor;
  if (Array.isArray(valor)) {
    const partes = valor.map(textoDeValor).filter((p): p is string => p !== null);
    return partes.length ? partes.join(", ") : null;
  }
  if (esSitio(valor)) return [valor.clave, valor.alias].filter(Boolean).join(" — ");
  return JSON.stringify(valor);
}

// El historial guarda el nombre del archivo, nunca la URL de descarga (lleva token).
export function textoDocumentos(valor: unknown): string | null {
  if (!Array.isArray(valor)) return null;
  const nombres = valor
    .filter((u): u is string => typeof u === "string")
    .map((u) => nombreDeUrl(u) || "archivo sin nombre");
  return nombres.length ? nombres.join(", ") : null;
}

// Compara solo los campos vigilados que vienen en `despues`; omite los que no cambian.
export function calcularCambios(antes: Ticket, despues: Partial<Ticket>, campos: CampoVigilado[]): CambioCampo[] {
  const cambios: CambioCampo[] = [];
  for (const { campo, etiqueta, formato = textoDeValor } of campos) {
    if (!(campo in despues)) continue;
    const valorAntes = formato(antes[campo]);
    const valorDespues = formato(despues[campo]);
    if (valorAntes === valorDespues) continue;
    cambios.push({ campo, etiqueta, antes: valorAntes, despues: valorDespues });
  }
  return cambios;
}

// abogadoAsignadoId es un id del catalogo ("Nombre - Puesto"); se muestra el nombre.
const textoAbogado = (valor: unknown): string | null =>
  typeof valor === "string" && valor ? findAbogado(valor)?.nombre ?? valor : null;
// Tickets previos no tienen el campo: ausente cuenta como "no".
const textoExclusion = (valor: unknown): string => (valor === true ? "sí" : "no");

export const CAMPOS_ESTATUS: CampoVigilado[] = [
  { campo: "estatus", etiqueta: "Estatus" },
  { campo: "fechaCierre", etiqueta: "Fecha de cierre" },
];

export const CAMPOS_ASIGNACION: CampoVigilado[] = [
  { campo: "abogadoAsignadoId", etiqueta: "Abogado asignado", formato: textoAbogado },
  { campo: "fechaAsignacion", etiqueta: "Fecha de asignacion" },
  { campo: "fechaCompromiso", etiqueta: "Fecha compromiso" },
];

export const CAMPOS_NOTAS_CIERRE: CampoVigilado[] = [{ campo: "notasCierre", etiqueta: "Notas de cierre" }];

// Incluye los derivados del servicio (categoria, puesto, SLA, fecha compromiso): solo aparecen si cambian.
export function camposSolicitud(nombreServicio: (id: string) => string | null): CampoVigilado[] {
  return [
    { campo: "areaEmpresa", etiqueta: "Area / Empresa" },
    {
      campo: "servicioId",
      etiqueta: "Servicio",
      formato: (valor) => (typeof valor === "string" && valor ? nombreServicio(valor) ?? valor : null),
    },
    { campo: "descripcion", etiqueta: "Descripcion" },
    { campo: "categoria", etiqueta: "Categoria" },
    { campo: "puestoResponsableSugerido", etiqueta: "Puesto responsable sugerido" },
    { campo: "slaInterno", etiqueta: "SLA interno" },
    { campo: "fechaCompromiso", etiqueta: "Fecha compromiso" },
  ];
}

export const CAMPOS_DOCUMENTOS: CampoVigilado[] = [{ campo: "documentacion", etiqueta: "Documentacion", formato: textoDocumentos }];

export const CAMPOS_SITIO: CampoVigilado[] = [{ campo: "sitioArrendamiento", etiqueta: "Sitio" }];

export const CAMPOS_EXCLUSION: CampoVigilado[] = [
  { campo: "excluidoDelPipeline", etiqueta: "Excluido del pipeline", formato: textoExclusion },
];

function nuevaEntrada(
  tipo: TipoHistorial,
  actor: ActorHistorial,
  ahora: Date,
  cambios: CambioCampo[],
  comentarioId?: string
): EntradaHistorial {
  return {
    fecha: ahora.toISOString(),
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    tipo,
    cambios,
    ...(comentarioId ? { comentarioId } : {}),
  };
}

export function construirEntrada(
  tipo: TipoHistorial,
  actor: ActorHistorial,
  ahora: Date,
  cambios: CambioCampo[],
  comentarioId?: string
): EntradaHistorial | null {
  return cambios.length ? nuevaEntrada(tipo, actor, ahora, cambios, comentarioId) : null;
}

function sinNulos(entradas: (EntradaHistorial | null)[]): EntradaHistorial[] {
  return entradas.filter((e): e is EntradaHistorial => e !== null);
}

export function entradasAsignacion(antes: Ticket, patch: Partial<Ticket>, actor: ActorHistorial, ahora: Date): EntradaHistorial[] {
  return sinNulos([
    construirEntrada("estatus", actor, ahora, calcularCambios(antes, patch, CAMPOS_ESTATUS)),
    construirEntrada("asignacion", actor, ahora, calcularCambios(antes, patch, CAMPOS_ASIGNACION)),
    construirEntrada("notas_cierre", actor, ahora, calcularCambios(antes, patch, CAMPOS_NOTAS_CIERRE)),
  ]);
}

export function entradasSolicitud(
  antes: Ticket,
  patch: Partial<Ticket>,
  actor: ActorHistorial,
  ahora: Date,
  nombreServicio: (id: string) => string | null
): EntradaHistorial[] {
  return sinNulos([
    construirEntrada("solicitud", actor, ahora, calcularCambios(antes, patch, camposSolicitud(nombreServicio))),
    construirEntrada("documentos", actor, ahora, calcularCambios(antes, patch, CAMPOS_DOCUMENTOS)),
  ]);
}

export function entradaSitio(antes: Ticket, patch: Partial<Ticket>, actor: ActorHistorial, ahora: Date): EntradaHistorial | null {
  return construirEntrada("sitio", actor, ahora, calcularCambios(antes, patch, CAMPOS_SITIO));
}

export function entradaExclusion(antes: Ticket, excluido: boolean, actor: ActorHistorial, ahora: Date): EntradaHistorial | null {
  return construirEntrada("exclusion", actor, ahora, calcularCambios(antes, { excluidoDelPipeline: excluido }, CAMPOS_EXCLUSION));
}

export function textoVistoBueno(visto: VistoBueno): string {
  return `${visto.nombre} (${visto.fecha})`;
}

export function entradaVistoBueno(actor: ActorHistorial, ahora: Date, visto: VistoBueno): EntradaHistorial {
  return nuevaEntrada("visto_bueno", actor, ahora, [
    { campo: "vistoBueno", etiqueta: "Visto bueno", antes: null, despues: textoVistoBueno(visto) },
  ]);
}

export interface DatosCambiosSolicitados {
  estatusAntes: Estatus;
  estatusDespues: Estatus;
  vistoBuenoAntes: VistoBueno | null;
  comentarioId: string;
}

export function entradaCambiosSolicitados(actor: ActorHistorial, ahora: Date, datos: DatosCambiosSolicitados): EntradaHistorial {
  const cambios: CambioCampo[] = [
    { campo: "estatus", etiqueta: "Estatus", antes: datos.estatusAntes, despues: datos.estatusDespues },
  ];
  if (datos.vistoBuenoAntes) {
    cambios.push({ campo: "vistoBueno", etiqueta: "Visto bueno", antes: textoVistoBueno(datos.vistoBuenoAntes), despues: null });
  }
  return nuevaEntrada("cambios_solicitados", actor, ahora, cambios, datos.comentarioId);
}

export function entradaComentarioEditado(
  actor: ActorHistorial,
  ahora: Date,
  comentarioId: string,
  textoAnterior: string | null,
  textoNuevo: string
): EntradaHistorial {
  return nuevaEntrada("comentario_editado", actor, ahora, [
    { campo: "texto", etiqueta: "Comentario", antes: textoAnterior, despues: textoNuevo },
  ], comentarioId);
}

export function entradaComentarioEliminado(
  actor: ActorHistorial,
  ahora: Date,
  comentarioId: string,
  textoAnterior: string | null
): EntradaHistorial {
  return nuevaEntrada("comentario_eliminado", actor, ahora, [
    { campo: "texto", etiqueta: "Comentario", antes: textoAnterior, despues: null },
  ], comentarioId);
}

export function actorDesdeSesion(sesion: { uid: string | null; nombre: string | null; role: Role }): ActorHistorial | null {
  if (!sesion.uid) return null;
  return { uid: sesion.uid, nombre: sesion.nombre ?? "", rol: sesion.role };
}

export const ETIQUETA_TIPO_HISTORIAL: Record<TipoHistorial, string> = {
  estatus: "Cambio de estatus",
  asignacion: "Asignacion",
  solicitud: "Edicion de la solicitud",
  documentos: "Documentos",
  sitio: "Sitio",
  exclusion: "Exclusion del pipeline",
  notas_cierre: "Notas de cierre",
  visto_bueno: "Visto bueno",
  cambios_solicitados: "Cambios solicitados",
  comentario_editado: "Comentario editado",
  comentario_eliminado: "Comentario eliminado",
};

export type ItemLineaTiempo =
  | { origen: "historial"; fecha: string; entrada: EntradaHistorialGuardada }
  | { origen: "estatus"; fecha: string; estatus: Estatus };

// Tickets previos al historial: su historialEstatus se muestra al final, sin detalle de campos.
// Lo posterior a la primera entrada ya esta en el historial (tipo "estatus"), no se repite.
export function lineaDeTiempo(entradas: EntradaHistorialGuardada[], historialEstatus: HistorialEntry[]): ItemLineaTiempo[] {
  const nuevas: ItemLineaTiempo[] = [...entradas]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((entrada) => ({ origen: "historial" as const, fecha: entrada.fecha, entrada }));
  const primera = entradas.reduce<string | null>((min, e) => (min === null || e.fecha < min ? e.fecha : min), null);
  const previas: ItemLineaTiempo[] = (historialEstatus ?? [])
    .filter((h) => primera === null || h.fecha < primera)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((h) => ({ origen: "estatus" as const, fecha: h.fecha, estatus: h.estatus }));
  return [...nuevas, ...previas];
}

// Espejo de "allow read" de tickets/{id}/historial en firestore.rules (isAdmin o abogado asignado).
export function puedeVerHistorial(
  sesion: { role: Role; abogadoId: string | null },
  ticket: Pick<Ticket, "abogadoAsignadoId">
): boolean {
  if (isAdminRole(sesion.role)) return true;
  return !!sesion.abogadoId && sesion.abogadoId === ticket.abogadoAsignadoId;
}
