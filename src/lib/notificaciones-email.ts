import { enviarEmail } from "@/lib/email";
import { getAdminDb } from "@/lib/firebase-admin";
import { LEGAL_STAFF_ROLES } from "@/types/user";
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

export async function destinatariosReales(tipo: TipoNotificacion, ticketId: string): Promise<string[]> {
  const db = getAdminDb();

  if (tipo === "nuevo_ticket") {
    // TEMPORAL mientras se prueba la plataforma: admin tambien recibe el aviso
    // de nuevo ticket aunque no atienda tickets. Quitar "admin" cuando se
    // valide el flujo (ver LEGAL_STAFF_ROLES en types/user.ts).
    const snap = await db.collection("users").where("role", "in", [...LEGAL_STAFF_ROLES, "admin"]).get();
    return snap.docs.map((d) => d.data()).filter((u) => u.activo && u.email).map((u) => u.email as string);
  }

  const ticket = (await db.collection("tickets").doc(ticketId).get()).data();
  if (!ticket) return [];

  if (tipo === "asignacion") {
    if (!ticket.abogadoAsignadoId) return [];
    const snap = await db.collection("users").where("abogadoId", "==", ticket.abogadoAsignadoId).limit(1).get();
    const email = snap.docs[0]?.data().email;
    return email ? [email] : [];
  }

  const solicitante = (await db.collection("users").doc(ticket.solicitanteId).get()).data();
  return solicitante?.email ? [solicitante.email] : [];
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
