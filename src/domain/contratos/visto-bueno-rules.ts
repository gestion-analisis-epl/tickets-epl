import type { VistoBueno } from "@/types/resumen-contrato";
import type { ActorHistorial, EntradaHistorial } from "@/types/historial";
import { entradaVistoBueno } from "@/domain/tickets/historial-rules";

// El visto bueno y su entrada de historial se guardan juntos (las reglas exigen ambos en el mismo lote).
export function prepararVistoBueno(actor: ActorHistorial, ahora: Date): { visto: VistoBueno; entrada: EntradaHistorial } {
  const visto: VistoBueno = { uid: actor.uid, nombre: actor.nombre, fecha: ahora.toISOString() };
  return { visto, entrada: entradaVistoBueno(actor, ahora, visto) };
}
