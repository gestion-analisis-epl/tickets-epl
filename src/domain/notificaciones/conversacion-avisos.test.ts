import { describe, expect, it } from "vitest";
import { esTipoSoloServidor } from "./conversacion-avisos";

describe("esTipoSoloServidor", () => {
  it("los avisos de la conversacion no se pueden pedir desde el cliente", () => {
    expect(esTipoSoloServidor("comentario_ticket")).toBe(true);
    expect(esTipoSoloServidor("cambios_solicitados")).toBe(true);
    expect(esTipoSoloServidor("cierre")).toBe(false);
    expect(esTipoSoloServidor(undefined)).toBe(false);
  });
});
