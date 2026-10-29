import { isAdminRole, type Role } from "@/types/user";
import type { Beneficiario, RevisionLegal, Ticket } from "@/types/ticket";
import { solicitudEditable } from "./etapa-permisos-rules";
import { esAltaRetroactiva } from "./alta-arrendador-rules";
import { SERVICIO_ALTA_ARRENDADOR_ID } from "@/lib/data/arrendamientos-temporal";

const TOTAL = 10000;

export class RevisionLegalIncompletaError extends Error {
  constructor(public faltantes: string[]) {
    super(`Falta completar la revisión legal: ${faltantes.join("; ")}.`);
  }
}

// El ultimo beneficiario absorbe la diferencia para que siempre sume 10000.
export function repartoEquitativo(n: number): number[] {
  const base = Math.floor(TOTAL / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? TOTAL - base * (n - 1) : base));
}

function sinUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const lleno = (s: string | undefined) => !!s && s.trim().length > 0;

// Deja solo lo que aplica a lo elegido; lo demas se borra para no guardar datos contradictorios.
export function normalizarRevisionLegal(r: RevisionLegal): RevisionLegal {
  const moral = r.tipoPropietario === "moral";
  const escenario = r.escenarioBeneficiario;
  const varios = escenario === "varios";
  const representante = varios && r.modalidadVarios === "representante";

  let beneficiarios: Beneficiario[] | undefined;
  if (varios && r.beneficiarios) {
    const nombres = r.beneficiarios.map((b) => b.nombre);
    if (r.modalidadVarios === "equitativo") {
      const pct = repartoEquitativo(nombres.length);
      beneficiarios = nombres.map((nombre, i) => ({ nombre, porcentaje: pct[i] }));
    } else if (r.modalidadVarios === "representante" && r.representanteComun !== undefined && r.representanteComun < nombres.length) {
      beneficiarios = nombres.map((nombre, i) => ({ nombre, porcentaje: i === r.representanteComun ? TOTAL : 0 }));
    } else {
      // Aun no se puede calcular: partes iguales como valor provisional (siempre suma 10000).
      const pct = repartoEquitativo(nombres.length);
      beneficiarios = nombres.map((nombre, i) => ({ nombre, porcentaje: pct[i] }));
    }
  }

  return sinUndefined({
    tipoPropietario: r.tipoPropietario,
    nombrePropietario: r.nombrePropietario,
    representanteLegal: moral ? r.representanteLegal : undefined,
    documentoPersonalidad: moral ? r.documentoPersonalidad : undefined,
    acreditaPropiedad: r.acreditaPropiedad,
    documentoPropiedad: r.acreditaPropiedad === true ? r.documentoPropiedad : undefined,
    cartaAutorizacion: r.acreditaPropiedad === false ? r.cartaAutorizacion : undefined,
    hayLimitacion: r.hayLimitacion,
    tipoLimitacion: r.hayLimitacion === true ? r.tipoLimitacion : undefined,
    escenarioBeneficiario: escenario,
    beneficiarioNombre: escenario === "tercero" ? r.beneficiarioNombre : undefined,
    documentoBeneficiario: escenario === "tercero" ? r.documentoBeneficiario : undefined,
    clausulaEspecial: escenario === "tercero" ? r.clausulaEspecial : undefined,
    modalidadVarios: varios ? r.modalidadVarios : undefined,
    beneficiarios,
    representanteComun: representante ? r.representanteComun : undefined,
    documentoRepresentante: representante ? r.documentoRepresentante : undefined,
    cartaRepresentante: representante ? r.cartaRepresentante : undefined,
    hayCondicionPago: r.hayCondicionPago,
    condicionPago: r.hayCondicionPago === true ? r.condicionPago : undefined,
  });
}

// Lista, en lenguaje simple, lo que todavia falta para dar por completa la revision legal.
export function faltantesRevisionLegal(r: RevisionLegal): string[] {
  const f: string[] = [];
  if (!r.tipoPropietario) f.push("Indica si el propietario es persona física o moral");
  else if (!lleno(r.nombrePropietario)) f.push(r.tipoPropietario === "moral" ? "Captura la razón social del propietario" : "Captura el nombre completo del propietario");
  if (r.tipoPropietario === "moral") {
    if (!lleno(r.representanteLegal)) f.push("Captura el nombre del representante legal");
    if (!r.documentoPersonalidad) f.push("Sube el documento de personalidad con actos de dominio para arrendar");
  }

  if (r.acreditaPropiedad === undefined) f.push("Indica si se acredita la propiedad");
  else if (r.acreditaPropiedad && !r.documentoPropiedad) f.push("Sube el documento que acredita la propiedad");
  else if (!r.acreditaPropiedad && !r.cartaAutorizacion) f.push("Sube la carta de autorización");

  if (r.hayLimitacion === undefined) f.push("Indica si existe alguna limitación");
  else if (r.hayLimitacion && !lleno(r.tipoLimitacion)) f.push("Captura el tipo de limitación");

  switch (r.escenarioBeneficiario) {
    case undefined: f.push("Elige quién recibe el pago de las rentas"); break;
    case "tercero":
      if (!lleno(r.beneficiarioNombre)) f.push("Captura el nombre del beneficiario");
      if (!r.documentoBeneficiario) f.push("Sube la acreditación del beneficiario");
      if (!r.clausulaEspecial) f.push("Confirma que se redactará la cláusula especial del beneficiario");
      break;
    case "varios": {
      const lista = r.beneficiarios ?? [];
      if (lista.length < 2 || lista.some((b) => !lleno(b.nombre))) f.push("Captura al menos 2 beneficiarios, cada uno con su nombre");
      if (!r.modalidadVarios) f.push("Elige si el pago se reparte en partes iguales o a un representante común");
      if (r.modalidadVarios === "representante") {
        if (r.representanteComun === undefined || r.representanteComun >= lista.length) f.push("Elige quién es el representante común");
        if (!r.documentoRepresentante) f.push("Sube la acreditación del representante común");
        if (!r.cartaRepresentante) f.push("Sube la carta que autoriza al representante común a recibir la renta");
      }
      break;
    }
  }

  if (r.hayCondicionPago === undefined) f.push("Indica si existe condición para el pago");
  else if (r.hayCondicionPago && !lleno(r.condicionPago)) f.push("Captura la condición para el pago");
  return f;
}

// Solo aplica a tickets de Alta con el bloque nuevo; los anteriores nunca quedan pendientes.
export function revisionLegalPendiente(t: Pick<Ticket, "altaArrendador" | "revisionLegal" | "servicioId">): string[] {
  return t.altaArrendador && t.servicioId === SERVICIO_ALTA_ARRENDADOR_ID ? faltantesRevisionLegal(t.revisionLegal ?? {}) : [];
}

type Sesion = { role: Role | null | undefined; abogadoId: string | null | undefined };

// Admin/Gerente Juridico y el abogado asignado a ESTE ticket (misma condicion que firestore.rules). Mesa de Control no.
function esAdminOAbogadoAsignado(sesion: Sesion, ticket: Pick<Ticket, "abogadoAsignadoId">): boolean {
  if (isAdminRole(sesion.role)) return true;
  return sesion.role === "abogado" && !!sesion.abogadoId && sesion.abogadoId === ticket.abogadoAsignadoId;
}

// Un ticket anterior (retroactivo) se edita en cualquier etapa menos Pre-Cierre, incluido Cierre;
// uno con los datos del solicitante, solo mientras la solicitud es editable (no en Pre-Cierre ni Cierre).
export function etapaPermiteEditar(ticket: Pick<Ticket, "servicioId" | "altaArrendador" | "estatus">): boolean {
  return esAltaRetroactiva(ticket) ? ticket.estatus !== "Pre-Cierre" : solicitudEditable(ticket.estatus);
}

export function puedeEditarRevisionLegal(
  sesion: Sesion,
  ticket: Pick<Ticket, "servicioId" | "abogadoAsignadoId" | "estatus" | "altaArrendador">
): boolean {
  return ticket.servicioId === SERVICIO_ALTA_ARRENDADOR_ID && etapaPermiteEditar(ticket) && esAdminOAbogadoAsignado(sesion, ticket);
}

// Completar los datos de alta que el solicitante no capturo (tickets anteriores) o corregirlos despues.
export function puedeEditarAltaRetroactiva(
  sesion: Sesion,
  ticket: Pick<Ticket, "servicioId" | "abogadoAsignadoId" | "estatus" | "altaArrendador">
): boolean {
  return esAltaRetroactiva(ticket) && ticket.estatus !== "Pre-Cierre" && esAdminOAbogadoAsignado(sesion, ticket);
}
