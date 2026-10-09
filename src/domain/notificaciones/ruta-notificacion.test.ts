import { describe, expect, it } from "vitest";
import { rutaNotificacion } from "./ruta-notificacion";

describe("rutaNotificacion", () => {
  it("el jefe de zona va a /pre-cierre; los demas a /tickets", () => {
    expect(rutaNotificacion("jefe_zona", "t1")).toBe("/pre-cierre/t1");
    expect(rutaNotificacion("solicitante", "t1")).toBe("/tickets/t1");
    expect(rutaNotificacion("admin", "t1")).toBe("/tickets/t1");
    expect(rutaNotificacion(null, "t1")).toBe("/tickets/t1");
  });
});
