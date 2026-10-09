import { describe, expect, it } from "vitest";
import { prepararVistoBueno } from "./visto-bueno-rules";

describe("prepararVistoBueno", () => {
  it("arma el visto bueno y su entrada de historial con la misma fecha", () => {
    const ahora = new Date("2026-10-09T15:00:00.000Z");
    const { visto, entrada } = prepararVistoBueno({ uid: "j1", nombre: "Jefe Uno", rol: "jefe_zona" }, ahora);
    expect(visto).toEqual({ uid: "j1", nombre: "Jefe Uno", fecha: ahora.toISOString() });
    expect(entrada).toMatchObject({ tipo: "visto_bueno", actorUid: "j1", actorRol: "jefe_zona", fecha: ahora.toISOString() });
    expect(entrada.cambios).toEqual([
      { campo: "vistoBueno", etiqueta: "Visto bueno", antes: null, despues: `Jefe Uno (${ahora.toISOString()})` },
    ]);
  });
});
