import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({ deleteTicketDocuments: async () => {} }));
import { ABOGADO_EJEMPLO_ID, crearServicioEjemplo, ETAPAS_EJEMPLO, ticketEjemplo } from "./ticket-ejemplo";
import { RevisionLegalIncompletaError, puedeEditarRevisionLegal } from "./revision-legal-rules";
import type { Ticket } from "@/types/ticket";

const catalogo = { findServicio: () => undefined };
const actor = { uid: "u", nombre: "Ejemplo", rol: "abogado" as const };

describe("ticket de ejemplo", () => {
  it("existe una etapa de ejemplo por cada estatus", () => {
    expect(ETAPAS_EJEMPLO).toHaveLength(8);
  });

  it("sin abogado antes de la asignacion y con revision legal vacia hasta Validacion y presentacion", () => {
    expect(ticketEjemplo("Recepcion de solicitud").abogadoAsignadoId).toBeNull();
    expect(ABOGADO_EJEMPLO_ID).toBeTruthy();
    const t = ticketEjemplo("Proceso en tramite");
    expect(t.abogadoAsignadoId).not.toBeNull();
    expect(t.revisionLegal).toBeUndefined();
    expect(puedeEditarRevisionLegal({ role: "abogado", abogadoId: t.abogadoAsignadoId }, t)).toBe(true);
  });

  it("Cambio de arrendador usa el mismo formulario: revision legal editable y documentos de cambio", () => {
    const t = ticketEjemplo("Proceso en tramite", "JUR-C072");
    expect(t.servicioId).toBe("JUR-C072");
    expect(t.altaArrendador?.tipoAlta).toBe("cambio");
    expect(t.altaArrendador?.documentos.contratoAnterior).toBeTruthy();
    expect(puedeEditarRevisionLegal({ role: "abogado", abogadoId: t.abogadoAsignadoId }, t)).toBe(true);
  });

  it("Pre-Cierre y Cierre traen la revision legal completa y ya no se edita", () => {
    const t = ticketEjemplo("Pre-Cierre");
    expect(t.revisionLegal?.nombrePropietario).toBeTruthy();
    expect(puedeEditarRevisionLegal({ role: "abogado", abogadoId: t.abogadoAsignadoId }, t)).toBe(false);
  });

  it("el servicio en memoria bloquea Pre-Cierre sin revision legal y lo permite al completarla", async () => {
    let ultimo: Ticket | null = null;
    const base = ticketEjemplo("Proceso en tramite");
    const service = crearServicioEjemplo(base, catalogo, (t) => { ultimo = t; });
    const pasar = () => service.updateTicketAsignacion(base.id, actor, { estatus: "Pre-Cierre", abogadoAsignadoId: base.abogadoAsignadoId, notasCierre: null });

    await expect(pasar()).rejects.toBeInstanceOf(RevisionLegalIncompletaError);

    await service.updateTicketRevisionLegal(base.id, ticketEjemplo("Pre-Cierre").revisionLegal!);
    await pasar();
    expect(ultimo!.estatus).toBe("Pre-Cierre");
  });
});
