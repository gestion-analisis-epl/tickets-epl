import { ESTATUS_VALUES, type Estatus, type RevisionLegal, type Ticket } from "@/types/ticket";
import type { TicketRepository } from "./ticket-repository";
import type { TicketNotifier } from "./ticket-notifier";
import type { ResumenContratoRepository } from "@/domain/contratos/resumen-contrato-repository";
import type { CatalogoLookup } from "@/domain/catalogo/catalogo-lookup";
import { createTicketService } from "./ticket-service";
import { SERVICIO_ALTA_ARRENDADOR_ID, SERVICIO_CAMBIO_ARRENDADOR_ID } from "@/lib/data/arrendamientos-temporal";
import type { UploadedDocument } from "@/lib/storage";
import { ABOGADOS } from "@/lib/data/abogados";

// Ticket ficticio de "Alta de arrendador" para la guia del abogado ("Ver como" > Abogado > etapa).
// Nada de esto existe en Firestore: se muestra con el detalle real y se guarda solo en memoria.

export const ID_TICKET_EJEMPLO = "ejemplo";

// Alta y Cambio de arrendador comparten el mismo formulario; solo cambia el servicio del ticket.
export const SERVICIOS_EJEMPLO: { servicioId: string; etiqueta: string }[] = [
  { servicioId: SERVICIO_ALTA_ARRENDADOR_ID, etiqueta: "Alta de arrendador" },
  { servicioId: SERVICIO_CAMBIO_ARRENDADOR_ID, etiqueta: "Cambio de arrendador" },
];

export const ETAPAS_EJEMPLO: { etapa: Estatus; etiqueta: string }[] = [
  { etapa: "Recepcion de solicitud", etiqueta: "Nuevo ticket" },
  { etapa: "Validacion de informacion con solicitante", etiqueta: "Validación con solicitante" },
  { etapa: "Proyeccion de nivel de servicio (SLA)", etiqueta: "Proyección de SLA" },
  { etapa: "Asignacion de responsable", etiqueta: "Ticket asignado" },
  { etapa: "Proceso en tramite", etiqueta: "Proceso en trámite" },
  { etapa: "Validacion y presentacion de requerimiento", etiqueta: "Validación y presentación" },
  { etapa: "Pre-Cierre", etiqueta: "Pre-Cierre" },
  { etapa: "Cierre", etiqueta: "Ticket cerrado" },
];

// URL con forma de Storage para que el detalle muestre el enlace; el archivo no existe.
const docFicticio = (nombre: string) =>
  `https://firebasestorage.googleapis.com/v0/b/ejemplo/o/${encodeURIComponent(`tickets/ejemplo/${nombre}`)}?alt=media`;

const REVISION_COMPLETA: RevisionLegal = {
  tipoPropietario: "fisica",
  nombrePropietario: "María Fernanda López Ruiz",
  acreditaPropiedad: true,
  documentoPropiedad: docFicticio("Escritura.pdf"),
  hayLimitacion: false,
  escenarioBeneficiario: "propietario",
  hayCondicionPago: false,
};

export function ticketEjemplo(etapa: Estatus, servicioId: string = SERVICIO_ALTA_ARRENDADOR_ID, ahora: Date = new Date()): Ticket {
  const esCambio = servicioId === SERVICIO_CAMBIO_ARRENDADOR_ID;
  const indice = ESTATUS_VALUES.indexOf(etapa);
  const asignado = indice >= ESTATUS_VALUES.indexOf("Asignacion de responsable");
  const preCierreOMas = indice >= ESTATUS_VALUES.indexOf("Pre-Cierre");
  const cerrado = etapa === "Cierre";
  const dia = 86_400_000;
  const iso = (diasAtras: number) => new Date(ahora.getTime() - diasAtras * dia).toISOString();

  return {
    id: ID_TICKET_EJEMPLO,
    folio: "JUR-EJEMPLO",
    fechaSolicitud: iso(12),
    solicitanteId: "solicitante-ejemplo",
    solicitanteNombre: "Carlos Mendoza (ejemplo)",
    areaEmpresa: "Grupo EPL",
    servicioId,
    descripcion: esCambio
      ? "Cambio de arrendador para el sitio de ejemplo. Datos ficticios para la guía."
      : "Alta del arrendador para el sitio de ejemplo. Datos ficticios para la guía.",
    documentacion: [],
    categoria: "Contratos",
    puestoResponsableSugerido: "Abogado Comercial",
    slaInterno: 5,
    fechaCompromiso: asignado ? iso(-4) : null,
    diasHabilesTranscurridos: null,
    nivelServicio: null,
    diasPipeline: null,
    contratoArrendamiento: {
      domicilio: "Av. Ejemplo 123, Col. Centro, Querétaro, Qro.",
      altaArrendador: "María Fernanda López Ruiz",
      solicitante: "Carlos Mendoza (ejemplo)",
      periodoInicio: "2026-01-01",
      periodoFin: "2028-12-31",
      condicionesPago: "63 - Cheques",
      montoPago: 180000,
      motivo: esCambio ? "Cambio de Arrendador" : "Alta de Arrendador",
    },
    sitioArrendamiento: { clave: "QRO-001", alias: "Sitio de ejemplo" },
    altaArrendador: {
      tipoAlta: esCambio ? "cambio" : "nuevo",
      ...(esCambio ? { motivoCambio: "El propietario vendió el inmueble (ejemplo)." } : {}),
      documentos: {
        ...(esCambio ? { personalidadLegal: docFicticio("Personalidad-legal.pdf"), contratoAnterior: docFicticio("Contrato-anterior.pdf") } : {}),
        identificaciones: docFicticio("Identificacion.pdf"),
        acreditacionPropiedad: docFicticio("Escritura.pdf"),
        predial: docFicticio("Predial.pdf"),
        comprobanteDomicilio: docFicticio("Comprobante-domicilio.pdf"),
      },
    },
    // Antes de Pre-Cierre queda vacia: es lo que el abogado debe llenar. Despues se ve ya completa.
    ...(preCierreOMas ? { revisionLegal: REVISION_COMPLETA } : {}),
    estatus: etapa,
    abogadoAsignadoId: asignado ? (ABOGADOS[1]?.id ?? ABOGADOS[0]?.id ?? null) : null,
    fechaAsignacion: asignado ? iso(8) : null,
    fechaCierre: cerrado ? iso(1) : null,
    notasCierre: cerrado ? "Alta concluida (ejemplo)." : null,
    tokenCalificacion: null,
    historialEstatus: ESTATUS_VALUES.slice(0, indice + 1).map((e, i) => ({ estatus: e, fecha: iso(12 - i), uid: "ejemplo" })),
    ...(preCierreOMas ? { conversacionAbiertaEn: iso(3) } : {}),
  };
}

// El servicio real de tickets (mismas validaciones y bloqueos) sobre un ticket en memoria.
export function crearServicioEjemplo(inicial: Ticket, catalogo: CatalogoLookup, onCambio: (t: Ticket) => void) {
  let actual: Ticket = { ...inicial };
  const aplicar = (patch: Partial<Ticket>) => {
    actual = { ...actual, ...patch };
    onCambio(actual);
  };

  const repo = {
    getById: async () => ({ ...actual }),
    update: async (_: string, patch: Partial<Ticket>) => aplicar(patch),
    updateConHistorial: async (_: string, patch: Partial<Ticket>) => aplicar(patch),
    delete: async () => {},
  } as unknown as TicketRepository;

  const notifier: TicketNotifier = {
    ticketCambioEstatus: async () => {},
    ticketAsignado: async () => {},
    ticketReasignado: async () => {},
    ticketCreado: async () => {},
  };

  const resumenes = {
    get: async () => null,
    upsert: async () => {},
    updateEstatus: async () => {},
    delete: async () => {},
  } as unknown as ResumenContratoRepository;

  return createTicketService(repo, notifier, catalogo, resumenes);
}

// Sube/borra "archivos" sin tocar Storage: el ejemplo solo simula la subida.
export function subirArchivoEjemplo(
  _basePath: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadedDocument> {
  onProgress?.(100);
  return Promise.resolve({ name: file.name, size: file.size, url: docFicticio(file.name), path: `tickets/ejemplo/${file.name}` });
}
