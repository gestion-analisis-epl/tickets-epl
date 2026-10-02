import { enviarEmail } from "@/lib/email";
import { getAdminDb } from "@/lib/firebase-admin";
import type { TipoNotificacion } from "@/lib/notificaciones";
import { filtrarDestinatarios } from "@/domain/notificaciones/preferencias-rules";
import { gerentesQueSupervisan } from "@/domain/users/supervision-rules";
import { formatearFecha, renderEmailNotificacion, type DatosTicketEmail } from "@/domain/notificaciones/email-template";

export const TIPO_LABEL: Record<TipoNotificacion, string> = {
  nuevo_ticket: "Nuevo ticket",
  asignacion: "Asignacion de abogado",
  cambio_estatus: "Cambio de estatus",
  cierre: "Cierre de ticket",
  creacion_solicitante: "Ticket creado",
  asignacion_solicitante: "Responsable asignado",
  reasignacion: "Reasignacion de abogado",
  reasignacion_solicitante: "Tu ticket fue reasignado",
};

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Logo del encabezado: URL de descarga (con token) del objeto img/grupo-epl.png en Storage.
// Los clientes de correo no pueden cargar imagenes de localhost ni de objetos privados.
const LOGO_URL = process.env.EMAIL_LOGO_URL
  ?? "https://firebasestorage.googleapis.com/v0/b/tickets-epl-legal/o/img%2Fgrupo-epl.png?alt=media&token=e3393b74-d17c-4d3f-a852-537459baadf7";

// Escotilla de seguridad: si esta variable trae correos, todo se redirige ahi
// en vez de a los destinatarios reales (ver .env.example).
const DESTINATARIOS_PRUEBA = (process.env.NOTIFICACIONES_DESTINATARIOS_PRUEBA ?? "")
  .split(",").map((e) => e.trim()).filter(Boolean);

// A donde se avisa cuando falla un envio o no se encontro a quien mandarlo
// (caso borde), para poder resolverlo en cuanto se detecte.
const ALERTA_EMAIL = "aescalante@grupoepl.com.mx";

// Nunca debe tirar: si la alerta misma falla (p.ej. SMTP caido), solo se
// registra en consola para no ocultar el error original ni generar un loop.
async function enviarAlerta(asunto: string, detalle: string): Promise<void> {
  try {
    await enviarEmail({
      to: ALERTA_EMAIL,
      subject: `[Alerta] ${asunto}`,
      html: `<p>${detalle}</p>`,
    });
  } catch (err) {
    console.error("No se pudo enviar la alerta de notificaciones:", err);
  }
}

// `omitidos`: usuarios que apagaron este correo desde el panel de admin. Si el destino queda
// vacio solo por eso, no se alerta "sin destinatarios" (fue una decision, no una falla).
interface Destino {
  emails: string[];
  omitidos: number;
}

const VACIO: Destino = { emails: [], omitidos: 0 };

// Legal/admin que dan seguimiento operativo: solo gerente_juridico y admin
// (mesa_control y abogado ya se enteran via el aviso de asignacion/cambio de
// estatus, dirigido puntualmente al abogado vinculado al ticket).
async function gerenteJuridicoYAdminDestino(tipo: TipoNotificacion): Promise<Destino> {
  const db = getAdminDb();
  const snap = await db.collection("users").where("role", "in", ["gerente_juridico", "admin"]).get();
  return filtrarDestinatarios(snap.docs.map((d) => d.data()), tipo);
}

async function gerentesAreaDestino(solicitanteId: string): Promise<Destino> {
  const db = getAdminDb();
  const snap = await db.collection("users").where("role", "==", "gerente_area").get();
  return filtrarDestinatarios(gerentesQueSupervisan(snap.docs.map((d) => d.data()), solicitanteId), "cierre");
}

async function abogadoAsignadoDestino(abogadoAsignadoId: string | null | undefined, tipo: TipoNotificacion): Promise<Destino> {
  if (!abogadoAsignadoId) return VACIO;
  const db = getAdminDb();
  const snap = await db.collection("users").where("abogadoId", "==", abogadoAsignadoId).limit(1).get();
  return filtrarDestinatarios(snap.docs.map((d) => d.data()), tipo);
}

// El cierre del solicitante lleva el link de calificacion: no se puede apagar.
async function solicitanteDestino(solicitanteId: string, tipo: TipoNotificacion): Promise<Destino> {
  const db = getAdminDb();
  const solicitante = (await db.collection("users").doc(solicitanteId).get()).data();
  if (!solicitante?.email) return VACIO;
  if (tipo === "cierre") return { emails: [solicitante.email], omitidos: 0 };
  return filtrarDestinatarios([{ ...solicitante, activo: true }], tipo);
}

function unir(...destinos: Destino[]): Destino {
  return {
    emails: Array.from(new Set(destinos.flatMap((d) => d.emails))),
    omitidos: destinos.reduce((total, d) => total + d.omitidos, 0),
  };
}

async function resolverDestinatarios(tipo: TipoNotificacion, ticketId: string): Promise<Destino> {
  if (tipo === "nuevo_ticket") {
    return gerenteJuridicoYAdminDestino(tipo);
  }

  const db = getAdminDb();
  const ticket = (await db.collection("tickets").doc(ticketId).get()).data();
  if (!ticket) return VACIO;

  if (tipo === "asignacion" || tipo === "reasignacion") {
    return abogadoAsignadoDestino(ticket.abogadoAsignadoId, tipo);
  }

  if (tipo === "cambio_estatus" || tipo === "cierre") {
    const [legalAdmin, solicitante] = await Promise.all([
      gerenteJuridicoYAdminDestino(tipo),
      solicitanteDestino(ticket.solicitanteId, tipo),
    ]);
    return unir(legalAdmin, solicitante);
  }

  // creacion_solicitante, asignacion_solicitante, reasignacion_solicitante -> solo el solicitante.
  return solicitanteDestino(ticket.solicitanteId, tipo);
}

export async function destinatariosReales(tipo: TipoNotificacion, ticketId: string): Promise<string[]> {
  return (await resolverDestinatarios(tipo, ticketId)).emails;
}

export interface EnviarNotificacionEmailInput {
  tipo: TipoNotificacion;
  mensaje: string;
  ticketId: string;
  ticketFolio: string;
  tokenCalificacion?: string;
}

// Best-effort: si algo falla al leer (ticket borrado, catalogo caido) el correo sale
// igual, solo sin la tarjeta de datos.
async function cargarDatosTicket(ticketId: string): Promise<DatosTicketEmail> {
  try {
    const db = getAdminDb();
    const ticket = (await db.collection("tickets").doc(ticketId).get()).data();
    if (!ticket) return {};

    const [servicioSnap, abogadoSnap] = await Promise.all([
      ticket.servicioId ? db.collection("catalogoServicios").doc(ticket.servicioId).get() : Promise.resolve(null),
      ticket.abogadoAsignadoId
        ? db.collection("users").where("abogadoId", "==", ticket.abogadoAsignadoId).limit(1).get()
        : Promise.resolve(null),
    ]);

    const sitio = ticket.sitioArrendamiento
      ? [ticket.sitioArrendamiento.clave, ticket.sitioArrendamiento.alias].filter(Boolean).join(" — ")
      : ticket.contratoArrendamiento?.sitio;

    return {
      solicitante: ticket.solicitanteNombre,
      servicio: servicioSnap?.data()?.servicio,
      categoria: ticket.categoria,
      sitio,
      estatus: ticket.estatus,
      abogado: abogadoSnap?.docs[0]?.data().nombre,
      fechaSolicitud: formatearFecha(ticket.fechaSolicitud),
      fechaCompromiso: formatearFecha(ticket.fechaCompromiso),
      fechaCierre: formatearFecha(ticket.fechaCierre),
    };
  } catch (err) {
    console.error("No se pudieron cargar los datos del ticket para el correo:", err);
    return {};
  }
}

function buildHtml(
  input: EnviarNotificacionEmailInput,
  ticket: DatosTicketEmail,
  verTicketUrl: string,
  calificarUrl: string | null
): string {
  return renderEmailNotificacion({
    tipo: input.tipo,
    mensaje: input.mensaje,
    folio: input.ticketFolio,
    verTicketUrl,
    calificarUrl,
    logoUrl: LOGO_URL,
    ticket,
  });
}

// Devuelve cuantos destinatarios recibieron el correo (0 si no habia a quien mandarlo).
export async function enviarNotificacionEmail(input: EnviarNotificacionEmailInput): Promise<number> {
  try {
    return await enviarNotificacionEmailInterno(input);
  } catch (err) {
    await enviarAlerta(
      `Fallo al enviar correo de "${TIPO_LABEL[input.tipo] ?? input.tipo}"`,
      `Ticket ${input.ticketFolio} (${input.ticketId}). Error: ${err instanceof Error ? err.message : String(err)}`
    );
    throw err;
  }
}

async function enviarNotificacionEmailInterno(input: EnviarNotificacionEmailInput): Promise<number> {
  const verTicketUrl = `${APP_URL}/tickets/${input.ticketId}`;
  const calificarUrl = input.tokenCalificacion ? `${APP_URL}/calificar/${input.ticketId}?token=${input.tokenCalificacion}` : null;
  const subject = `${TIPO_LABEL[input.tipo] ?? input.tipo} — ${input.ticketFolio}`;
  const datosTicket = await cargarDatosTicket(input.ticketId);

  // El link de calificacion es personal del solicitante: en "cierre" se separa el
  // envio para que gerente_juridico/admin no lo reciban.
  if (!DESTINATARIOS_PRUEBA.length && input.tipo === "cierre" && calificarUrl) {
    const db = getAdminDb();
    const ticket = (await db.collection("tickets").doc(input.ticketId).get()).data();
    const [legalAdmin, solicitante, gerentesArea] = await Promise.all([
      gerenteJuridicoYAdminDestino("cierre"),
      ticket ? solicitanteDestino(ticket.solicitanteId, "cierre") : Promise.resolve(VACIO),
      ticket ? gerentesAreaDestino(ticket.solicitanteId) : Promise.resolve(VACIO),
    ]);

    const sinNadie = [legalAdmin, solicitante].every((d) => d.emails.length === 0);
    if (sinNadie && legalAdmin.omitidos === 0) {
      await enviarAlerta(
        `Sin destinatarios para "${TIPO_LABEL.cierre}"`,
        `Ticket ${input.ticketFolio} (${input.ticketId}): no se encontro correo de gerente_juridico/admin ni del solicitante.`
      );
      return 0;
    }

    let total = 0;
    const envios: [Destino, string | null][] = [[legalAdmin, null], [solicitante, calificarUrl], [gerentesArea, null]];
    for (const [destino, linkCalificar] of envios) {
      if (!destino.emails.length) continue;
      await enviarEmail({ to: destino.emails.join(", "), subject, html: buildHtml(input, datosTicket, verTicketUrl, linkCalificar) });
      total += destino.emails.length;
    }
    return total;
  }

  const { emails: destinatarios, omitidos } = DESTINATARIOS_PRUEBA.length
    ? { emails: DESTINATARIOS_PRUEBA, omitidos: 0 }
    : await resolverDestinatarios(input.tipo, input.ticketId);
  if (destinatarios.length === 0) {
    if (omitidos > 0) return 0;
    await enviarAlerta(
      `Sin destinatarios para "${TIPO_LABEL[input.tipo] ?? input.tipo}"`,
      `Ticket ${input.ticketFolio} (${input.ticketId}): no se encontro a quien enviarle este correo.`
    );
    return 0;
  }

  await enviarEmail({
    to: destinatarios.join(", "),
    subject,
    html: buildHtml(input, datosTicket, verTicketUrl, calificarUrl),
  });

  return destinatarios.length;
}
