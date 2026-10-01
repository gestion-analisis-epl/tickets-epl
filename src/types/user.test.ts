import { describe, expect, it } from "vitest";
import { isAdminRole, isSolicitanteRole, LEGAL_STAFF_ROLES, puedeSupervisar, STAFF_ROLES, type Role } from "./user";

describe("isSolicitanteRole", () => {
  it.each<[Role, boolean]>([
    ["solicitante", true],
    ["gerente_area", true],
    ["mesa_control", false],
    ["abogado", false],
    ["gerente_juridico", false],
    ["admin", false],
  ])("%s -> %s", (role, esperado) => {
    expect(isSolicitanteRole(role)).toBe(esperado);
  });

  it("un rol ausente no cuenta como solicitante", () => {
    expect(isSolicitanteRole(null)).toBe(false);
    expect(isSolicitanteRole(undefined)).toBe(false);
  });
});

describe("puedeSupervisar", () => {
  it("solo el gerente de area supervisa a otros usuarios", () => {
    expect(puedeSupervisar("gerente_area")).toBe(true);
    expect(puedeSupervisar("solicitante")).toBe(false);
    expect(puedeSupervisar("admin")).toBe(false);
    expect(puedeSupervisar("gerente_juridico")).toBe(false);
    expect(puedeSupervisar(null)).toBe(false);
  });
});

describe("gerente_area no cambia otros grupos de roles", () => {
  it("no es staff de Legal: no recibe los avisos de nuevo ticket ni el flujo operativo", () => {
    expect(LEGAL_STAFF_ROLES).not.toContain("gerente_area");
  });

  it("no se crea con correo y contrasena: entra con su cuenta de Google", () => {
    expect(STAFF_ROLES).not.toContain("gerente_area");
  });

  it("no tiene permisos de admin", () => {
    expect(isAdminRole("gerente_area")).toBe(false);
  });
});
