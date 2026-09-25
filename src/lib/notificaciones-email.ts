import { enviarEmail } from "@/lib/email";
import { getAdminDb } from "@/lib/firebase-admin";
import type { TipoNotificacion } from "@/lib/notificaciones";

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
const BOTON = "display:inline-block;padding:10px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600";

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

// Legal/admin que dan seguimiento operativo: solo gerente_juridico y admin
// (mesa_control y abogado ya se enteran via el aviso de asignacion/cambio de
// estatus, dirigido puntualmente al abogado vinculado al ticket).
async function gerenteJuridicoYAdminEmails(): Promise<string[]> {
  const db = getAdminDb();
  const snap = await db.collection("users").where("role", "in", ["gerente_juridico", "admin"]).get();
  return snap.docs.map((d) => d.data()).filter((u) => u.activo && u.email).map((u) => u.email as string);
}

async function abogadoAsignadoEmail(abogadoAsignadoId: string | null | undefined): Promise<string[]> {
  if (!abogadoAsignadoId) return [];
  const db = getAdminDb();
  const snap = await db.collection("users").where("abogadoId", "==", abogadoAsignadoId).limit(1).get();
  const email = snap.docs[0]?.data().email;
  return email ? [email] : [];
}

async function solicitanteEmail(solicitanteId: string): Promise<string[]> {
  const db = getAdminDb();
  const solicitante = (await db.collection("users").doc(solicitanteId).get()).data();
  return solicitante?.email ? [solicitante.email] : [];
}

export async function destinatariosReales(tipo: TipoNotificacion, ticketId: string): Promise<string[]> {
  if (tipo === "nuevo_ticket") {
    return gerenteJuridicoYAdminEmails();
  }

  const db = getAdminDb();
  const ticket = (await db.collection("tickets").doc(ticketId).get()).data();
  if (!ticket) return [];

  if (tipo === "asignacion" || tipo === "reasignacion") {
    return abogadoAsignadoEmail(ticket.abogadoAsignadoId);
  }

  if (tipo === "cambio_estatus" || tipo === "cierre") {
    const [legalAdmin, solicitante] = await Promise.all([
      gerenteJuridicoYAdminEmails(),
      solicitanteEmail(ticket.solicitanteId),
    ]);
    return Array.from(new Set([...legalAdmin, ...solicitante]));
  }

  // creacion_solicitante, asignacion_solicitante, reasignacion_solicitante -> solo el solicitante.
  return solicitanteEmail(ticket.solicitanteId);
}

export interface EnviarNotificacionEmailInput {
  tipo: TipoNotificacion;
  mensaje: string;
  ticketId: string;
  ticketFolio: string;
  tokenCalificacion?: string;
}

function buildHtml(mensaje: string, ticketFolio: string, verTicketUrl: string, calificarUrl: string | null): string {
  return `
      <p>${mensaje}</p>
      <p style="color:#666;font-size:12px">Ticket: ${ticketFolio}</p>
      <p><a href="${verTicketUrl}" style="${BOTON}">Ver ticket</a></p>
      ${calificarUrl ? `<p><a href="${calificarUrl}" style="${BOTON};background:#15803d">Calificar tu experiencia</a></p>` : ""}
    `;
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

  // El link de calificacion es personal del solicitante: en "cierre" se separa el
  // envio para que gerente_juridico/admin no lo reciban.
  if (!DESTINATARIOS_PRUEBA.length && input.tipo === "cierre" && calificarUrl) {
    const db = getAdminDb();
    const ticket = (await db.collection("tickets").doc(input.ticketId).get()).data();
    const [legalAdmin, solicitante] = await Promise.all([
      gerenteJuridicoYAdminEmails(),
      ticket ? solicitanteEmail(ticket.solicitanteId) : Promise.resolve([]),
    ]);

    if (legalAdmin.length === 0 && solicitante.length === 0) {
      await enviarAlerta(
        `Sin destinatarios para "${TIPO_LABEL.cierre}"`,
        `Ticket ${input.ticketFolio} (${input.ticketId}): no se encontro correo de gerente_juridico/admin ni del solicitante.`
      );
      return 0;
    }

    let total = 0;
    if (legalAdmin.length) {
      await enviarEmail({ to: legalAdmin.join(", "), subject, html: buildHtml(input.mensaje, input.ticketFolio, verTicketUrl, null) });
      total += legalAdmin.length;
    }
    if (solicitante.length) {
      await enviarEmail({ to: solicitante.join(", "), subject, html: buildHtml(input.mensaje, input.ticketFolio, verTicketUrl, calificarUrl) });
      total += solicitante.length;
    }
    return total;
  }

  const destinatarios = DESTINATARIOS_PRUEBA.length ? DESTINATARIOS_PRUEBA : await destinatariosReales(input.tipo, input.ticketId);
  if (destinatarios.length === 0) {
    await enviarAlerta(
      `Sin destinatarios para "${TIPO_LABEL[input.tipo] ?? input.tipo}"`,
      `Ticket ${input.ticketFolio} (${input.ticketId}): no se encontro a quien enviarle este correo.`
    );
    return 0;
  }

  await enviarEmail({
    to: destinatarios.join(", "),
    subject,
    html: buildHtml(input.mensaje, input.ticketFolio, verTicketUrl, calificarUrl),
  });

  return destinatarios.length;
}
