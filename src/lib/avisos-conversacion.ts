import { getAdminDb } from "./firebase-admin";
import { APP_URL, enviarNotificacionEmailA } from "./notificaciones-email";
import {
  correosPorEnlace,
  destinatariosAviso,
  mensajeAviso,
  type EnlaceAviso,
  type TipoAvisoConversacion,
  type UsuarioAviso,
} from "@/domain/notificaciones/conversacion-avisos";
import type { Ticket } from "@/types/ticket";

// Solo servidor (Admin SDK).
export interface AvisoConversacionInput {
  tipo: TipoAvisoConversacion;
  ticketId: string;
  autorUid: string;
  autorNombre: string;
}

type DocUsuario = Omit<UsuarioAviso, "uid">;

async function cargarUsuarios(ticket: Ticket): Promise<UsuarioAviso[]> {
  const users = getAdminDb().collection("users");
  const [porRol, dueno, abogado] = await Promise.all([
    users.where("role", "in", ["gerente_juridico", "admin", "jefe_zona"]).get(),
    users.doc(ticket.solicitanteId).get(),
    ticket.abogadoAsignadoId ? users.where("abogadoId", "==", ticket.abogadoAsignadoId).get() : Promise.resolve(null),
  ]);
  const lista: UsuarioAviso[] = porRol.docs.map((d) => ({ ...(d.data() as DocUsuario), uid: d.id }));
  if (dueno.exists) lista.push({ ...(dueno.data() as DocUsuario), uid: dueno.id });
  for (const d of abogado?.docs ?? []) lista.push({ ...(d.data() as DocUsuario), uid: d.id });
  return lista;
}

// Campana (un lote de notificaciones dirigidas por uid) + correo por enlace. Sin el texto del comentario.
export async function avisarConversacion(input: AvisoConversacionInput): Promise<void> {
  const db = getAdminDb();
  const snap = await db.collection("tickets").doc(input.ticketId).get();
  if (!snap.exists) return;
  const ticket = { ...snap.data(), id: snap.id } as Ticket;

  const destinatarios = destinatariosAviso(input.tipo, ticket, await cargarUsuarios(ticket), input.autorUid);
  if (destinatarios.length === 0) return;

  const mensaje = mensajeAviso(input.tipo, ticket.folio, input.autorNombre);
  const fecha = new Date().toISOString();
  const lote = db.batch();
  for (const { usuario } of destinatarios) {
    lote.set(db.collection("notificaciones").doc(), {
      ticketId: ticket.id,
      ticketFolio: ticket.folio,
      tipo: input.tipo,
      mensaje,
      fecha,
      paraUid: usuario.uid,
      paraRoles: null,
      leidoPor: [],
    });
  }
  await lote.commit();

  const correos = correosPorEnlace(destinatarios, input.tipo);
  const enlaces: Record<EnlaceAviso, string> = {
    tickets: `${APP_URL}/tickets/${ticket.id}`,
    "pre-cierre": `${APP_URL}/pre-cierre/${ticket.id}`,
  };
  for (const enlace of ["tickets", "pre-cierre"] as const) {
    if (correos[enlace].length === 0) continue;
    await enviarNotificacionEmailA(
      { tipo: input.tipo, mensaje, ticketId: ticket.id, ticketFolio: ticket.folio },
      correos[enlace],
      enlaces[enlace]
    );
  }
}
