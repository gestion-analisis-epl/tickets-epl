import { firestoreTicketRepository } from "@/infrastructure/firestore/ticket-repository";
import { firestoreTicketNotifier } from "@/infrastructure/firestore/ticket-notifier";
import { createTicketService } from "@/domain/tickets/ticket-service";
import { findServicio } from "./catalogo";

export type { NuevoTicketInput } from "@/domain/tickets/nuevo-ticket";
export type { AsignacionInput } from "@/domain/tickets/asignacion-rules";
export type { SolicitudInput } from "@/domain/tickets/solicitud-rules";
export type { BackfillResultado } from "@/domain/tickets/ticket-service";

const ticketService = createTicketService(firestoreTicketRepository, firestoreTicketNotifier, { findServicio });

export const createTicket = ticketService.createTicket;
export const subscribeTickets = ticketService.subscribeTickets;
export const subscribeTicket = ticketService.subscribeTicket;
export const updateTicketAsignacion = ticketService.updateTicketAsignacion;
export const reenviarNotificacionReasignacion = ticketService.reenviarNotificacionReasignacion;
export const updateTicketSolicitud = ticketService.updateTicketSolicitud;
export const deleteTicket = ticketService.deleteTicket;
export const submitSatisfaccion = ticketService.submitSatisfaccion;
export const backfillSlaHistorico = ticketService.backfillSlaHistorico;
