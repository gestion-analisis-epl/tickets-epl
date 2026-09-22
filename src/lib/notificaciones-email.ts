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
};

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BOTON = "display:inline-block;padding:10px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600";

// Escotilla de seguridad: si esta variable trae correos, todo se redirige ahi
// en vez de a los destinatarios reales (ver .env.example).
const DESTINATARIOS_PRUEBA = (process.env.NOTIFICACIONES_DESTINATARIOS_PRUEBA ?? "")
  .split(",").map((e) => e.trim()).filter(Boolean);

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

  if (tipo === "asignacion") {
    const [abogado, legalAdmin] = await Promise.all([
      abogadoAsignadoEmail(ticket.abogadoAsignadoId),
      gerenteJuridicoYAdminEmails(),
    ]);
    return Array.from(new Set([...abogado, ...legalAdmin]));
  }

  if (tipo === "cambio_estatus") {
    const [abogado, legalAdmin, solicitante] = await Promise.all([
      abogadoAsignadoEmail(ticket.abogadoAsignadoId),
      gerenteJuridicoYAdminEmails(),
      solicitanteEmail(ticket.solicitanteId),
    ]);
    return Array.from(new Set([...abogado, ...legalAdmin, ...solicitante]));
  }

  // creacion_solicitante, asignacion_solicitante, cierre -> solo el solicitante.
  return solicitanteEmail(ticket.solicitanteId);
}

export interface EnviarNotificacionEmailInput {
  tipo: TipoNotificacion;
  mensaje: string;
  ticketId: string;
  ticketFolio: string;
  tokenCalificacion?: string;
}

// Devuelve cuantos destinatarios recibieron el correo (0 si no habia a quien mandarlo).
export async function enviarNotificacionEmail(input: EnviarNotificacionEmailInput): Promise<number> {
  const destinatarios = DESTINATARIOS_PRUEBA.length ? DESTINATARIOS_PRUEBA : await destinatariosReales(input.tipo, input.ticketId);
  if (destinatarios.length === 0) return 0;

  const verTicketUrl = `${APP_URL}/tickets/${input.ticketId}`;
  const calificarUrl = input.tokenCalificacion ? `${APP_URL}/calificar/${input.ticketId}?token=${input.tokenCalificacion}` : null;

  await enviarEmail({
    to: destinatarios.join(", "),
    subject: `${TIPO_LABEL[input.tipo] ?? input.tipo} — ${input.ticketFolio}`,
    html: `
      <p>${input.mensaje}</p>
      <p style="color:#666;font-size:12px">Ticket: ${input.ticketFolio}</p>
      <p><a href="${verTicketUrl}" style="${BOTON}">Ver ticket</a></p>
      ${calificarUrl ? `<p><a href="${calificarUrl}" style="${BOTON};background:#15803d">Calificar tu experiencia</a></p>` : ""}
    `,
  });

  return destinatarios.length;
}
