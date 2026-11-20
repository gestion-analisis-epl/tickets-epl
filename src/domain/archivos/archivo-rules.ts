import type { AccionArchivo, OrigenArchivo, RegistroArchivo, RegistroArchivoGuardado } from "@/types/archivo";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import { rutaDeUrlStorage } from "@/lib/storage-ruta";
import { nombreDeUrl } from "@/domain/documentos/nombre-url";
import { construirEntrada } from "@/domain/tickets/historial-rules";

export const ETIQUETA_ORIGEN_ARCHIVO: Record<OrigenArchivo, string> = {
  documentacion: "Documentación",
  formato_arrendamiento: "Formato de arrendamiento",
  documento_arrendamiento: "Documento de arrendamiento",
  alta: "Documento de alta de arrendador",
  revision_legal: "Anexo de la revisión legal",
};

// Campos de RevisionLegal que guardan la URL de un archivo (ver types/ticket.ts).
export const CAMPOS_DOCUMENTO_REVISION = [
  "documentoPersonalidad",
  "documentoPropiedad",
  "cartaAutorizacion",
  "documentoBeneficiario",
  "documentoRepresentante",
  "cartaRepresentante",
] as const;

interface ArchivoConocido {
  ruta?: string;
  url?: string;
  nombre?: string;
}

// null si no se puede saber la ruta en Storage (URL que no es de Firebase Storage).
export function registroArchivo(
  accion: AccionArchivo,
  archivo: ArchivoConocido,
  origen: OrigenArchivo,
  actor: ActorHistorial,
  ahora: Date,
  campo?: string
): RegistroArchivo | null {
  const ruta = archivo.ruta ?? (archivo.url ? rutaDeUrlStorage(archivo.url) : null);
  if (!ruta) return null;
  const nombre = archivo.nombre ?? (archivo.url ? nombreDeUrl(archivo.url) : "");
  return {
    nombre: nombre || "archivo sin nombre",
    ruta,
    origen,
    accion,
    fecha: ahora.toISOString(),
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    actorRol: actor.rol,
    ...(campo ? { campo } : {}),
  };
}

// Una entrada del Historial por archivo: el actor y la fecha salen del propio registro.
export function entradaArchivo(registro: RegistroArchivo): EntradaHistorial {
  const subido = registro.accion === "subido";
  const actor: ActorHistorial = { uid: registro.actorUid, nombre: registro.actorNombre, rol: registro.actorRol };
  const entrada = construirEntrada(subido ? "archivo_subido" : "archivo_eliminado", actor, new Date(registro.fecha), [
    {
      campo: "archivo",
      etiqueta: ETIQUETA_ORIGEN_ARCHIVO[registro.origen],
      antes: subido ? null : registro.nombre,
      despues: subido ? registro.nombre : null,
    },
  ]);
  if (!entrada) throw new Error("La entrada de archivo siempre lleva un cambio.");
  return entrada;
}

function sinNulos(registros: (RegistroArchivo | null)[]): RegistroArchivo[] {
  return registros.filter((r): r is RegistroArchivo => r !== null);
}

// Listas de URLs (p. ej. ticket.documentacion): lo nuevo es "subido", lo que ya no está es "eliminado".
export function registrosPorCambioDeUrls(
  antes: string[],
  despues: string[],
  origen: OrigenArchivo,
  actor: ActorHistorial,
  ahora: Date,
  campo?: string
): RegistroArchivo[] {
  return sinNulos([
    ...despues.filter((u) => !antes.includes(u)).map((u) => registroArchivo("subido", { url: u }, origen, actor, ahora, campo)),
    ...antes.filter((u) => !despues.includes(u)).map((u) => registroArchivo("eliminado", { url: u }, origen, actor, ahora, campo)),
  ]);
}

function urlDeCampo(objeto: object | undefined, clave: string): string[] {
  const valor = (objeto as Record<string, unknown> | undefined)?.[clave];
  return typeof valor === "string" && valor ? [valor] : [];
}

// Documentos de un solo archivo por campo (revisión legal, documentos de Alta): el campo queda en el registro.
export function registrosPorCambioDeSlots(
  antes: object | undefined,
  despues: object | undefined,
  claves: readonly string[],
  origen: OrigenArchivo,
  actor: ActorHistorial,
  ahora: Date
): RegistroArchivo[] {
  return claves.flatMap((clave) =>
    registrosPorCambioDeUrls(urlDeCampo(antes, clave), urlDeCampo(despues, clave), origen, actor, ahora, clave)
  );
}

export interface ArchivoSubidoEnFormulario {
  name: string;
  path?: string;
  status: string;
}

export interface GrupoArchivosCreacion {
  origen: OrigenArchivo;
  campo?: string;
  archivos: ArchivoSubidoEnFormulario[];
}

// Archivos que de verdad quedan en el ticket nuevo (los de borrador que se quitaron o fallaron no cuentan).
export function registrosDeCreacion(grupos: GrupoArchivosCreacion[], actor: ActorHistorial, ahora: Date): RegistroArchivo[] {
  return sinNulos(
    grupos.flatMap((g) =>
      g.archivos
        .filter((a) => a.status === "done" && a.path)
        .map((a) => registroArchivo("subido", { ruta: a.path, nombre: a.name }, g.origen, actor, ahora, g.campo))
    )
  );
}

// Quién subió el archivo que hoy está en la URL: el registro de subida más reciente de esa ruta.
// null en tickets anteriores a la trazabilidad (la interfaz muestra "Origen no registrado").
export function autorDeArchivo(registros: RegistroArchivoGuardado[], url: string): RegistroArchivoGuardado | null {
  const ruta = rutaDeUrlStorage(url);
  if (!ruta) return null;
  const subidas = registros.filter((r) => r.ruta === ruta && r.accion === "subido");
  if (subidas.length === 0) return null;
  return subidas.reduce((a, b) => (a.fecha >= b.fecha ? a : b));
}
