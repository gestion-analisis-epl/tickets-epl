import type { Ticket } from "@/types/ticket";
import type { ResumenContrato } from "@/types/resumen-contrato";
import type { Role } from "@/types/user";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import type { NuevoComentario } from "@/types/comentario";
import { calcularPatchAsignacion } from "./asignacion-rules";
import { validarTextoComentario } from "./conversacion-rules";
import { entradaCambiosSolicitados } from "./historial-rules";

export const ESTATUS_TRAS_PEDIR_CAMBIOS = "Proceso en tramite" as const;

export class PedirCambiosError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

export interface OperacionPedirCambios {
  ticketId: string;
  patchTicket: Partial<Ticket>;
  patchResumen: Pick<ResumenContrato, "estatus" | "vistoBueno" | "actualizadoEn"> | null;
  comentarioId: string;
  comentario: NuevoComentario;
  entrada: EntradaHistorial;
}

export interface DepsPedirCambios {
  cargarUsuario(uid: string): Promise<{ nombre: string; role: Role; activo: boolean } | null>;
  cargarTicket(id: string): Promise<Ticket | null>;
  cargarResumen(id: string): Promise<ResumenContrato | null>;
  nuevoIdComentario(ticketId: string): string;
  // Una sola operacion atomica (transaccion del Admin SDK en la ruta).
  guardar(op: OperacionPedirCambios): Promise<void>;
  avisar(info: { ticketId: string; autorUid: string; autorNombre: string }): Promise<void>;
  ahora(): Date;
}

export async function pedirCambios(
  deps: DepsPedirCambios,
  uid: string,
  ticketId: string,
  texto: unknown
): Promise<OperacionPedirCambios> {
  const usuario = await deps.cargarUsuario(uid);
  if (!usuario || usuario.role !== "jefe_zona" || !usuario.activo) {
    throw new PedirCambiosError(403, "No puedes pedir cambios en este ticket.");
  }

  const validado = validarTextoComentario(typeof texto === "string" ? texto : "");
  if (!validado.ok) throw new PedirCambiosError(400, validado.error);

  const ticket = await deps.cargarTicket(ticketId);
  if (!ticket) throw new PedirCambiosError(404, "Ticket no encontrado.");
  if (ticket.estatus !== "Pre-Cierre") throw new PedirCambiosError(409, "El ticket ya no esta en Pre-Cierre.");

  const ahora = deps.ahora();
  const actor: ActorHistorial = { uid, nombre: usuario.nombre, rol: usuario.role };
  // Mismo calculo que un cambio de estatus de Legal: agrega la entrada a historialEstatus (el SLA se reanuda).
  const { patch } = calcularPatchAsignacion(
    ticket,
    { estatus: ESTATUS_TRAS_PEDIR_CAMBIOS, abogadoAsignadoId: ticket.abogadoAsignadoId, notasCierre: ticket.notasCierre },
    uid,
    ahora
  );
  const resumen = await deps.cargarResumen(ticketId);
  const comentarioId = deps.nuevoIdComentario(ticketId);

  const op: OperacionPedirCambios = {
    ticketId,
    patchTicket: patch,
    patchResumen: resumen
      ? { estatus: ESTATUS_TRAS_PEDIR_CAMBIOS, vistoBueno: null, actualizadoEn: ahora.toISOString() }
      : null,
    comentarioId,
    comentario: {
      autorUid: uid,
      autorNombre: usuario.nombre,
      autorRol: "jefe_zona",
      texto: validado.texto,
      tipo: "cambios_solicitados",
      creadoEn: ahora.toISOString(),
      eliminado: false,
      avisoEnviado: true, // el aviso lo manda esta misma operacion
    },
    entrada: entradaCambiosSolicitados(actor, ahora, {
      estatusAntes: ticket.estatus,
      estatusDespues: ESTATUS_TRAS_PEDIR_CAMBIOS,
      vistoBuenoAntes: resumen?.vistoBueno ?? null,
      comentarioId,
    }),
  };

  await deps.guardar(op);
  await deps.avisar({ ticketId, autorUid: uid, autorNombre: usuario.nombre }).catch((err) => {
    console.error("Aviso de cambios solicitados fallo:", err instanceof Error ? err.message : "error desconocido");
  });
  return op;
}
