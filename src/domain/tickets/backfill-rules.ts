import { businessDaysBetween } from "@/lib/business-days";
import { diasHabilesSla } from "./sla-pausa-rules";
import type { Ticket } from "@/types/ticket";

export type BackfillCalculo =
  | { omitido: true }
  | { omitido: false; diasPipeline: number; diasHabilesTranscurridos: number | null; nivelServicio: number | null };

export function calcularBackfill(t: Ticket): BackfillCalculo {
  if (!t.fechaSolicitud || !t.fechaCierre) return { omitido: true };

  const diasPipeline = businessDaysBetween(new Date(t.fechaSolicitud), new Date(t.fechaCierre));

  if (!t.fechaAsignacion) {
    // Nunca se asigno abogado: el SLA no llego a arrancar.
    return { omitido: false, diasPipeline, diasHabilesTranscurridos: null, nivelServicio: null };
  }

  const dias = diasHabilesSla(t, new Date(t.fechaCierre));
  return { omitido: false, diasPipeline, diasHabilesTranscurridos: dias, nivelServicio: t.slaInterno - dias };
}
