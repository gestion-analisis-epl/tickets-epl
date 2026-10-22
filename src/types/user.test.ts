import { describe, expect, it } from "vitest";
import { esJefeZona, esRolSoloResumen, esSitios, puedeDarVistoBueno, ROLES_SOLO_RESUMEN, isAdminRole, isSolicitanteRole, LEGAL_STAFF_ROLES, puedeSupervisar, puedeVerDashboard, STAFF_ROLES, type Role } from "./user";

describe("isSolicitanteRole", () => {
  it.each<[Role, boolean]>([
    ["solicitante", true],
    ["gerente_area", true],
    ["mesa_control", false],
    ["abogado", false],
    ["gerente_juridico", false],
    ["admin", false],
    ["jefe_zona", false],
    ["sitios", false],
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

describe("jefe_zona", () => {
  it("esJefeZona solo es verdadero para ese rol", () => {
    expect(esJefeZona("jefe_zona")).toBe(true);
    expect(esJefeZona("gerente_area")).toBe(false);
    expect(esJefeZona("admin")).toBe(false);
    expect(esJefeZona(null)).toBe(false);
    expect(esJefeZona(undefined)).toBe(false);
  });

  it("se crea con correo y contrasena desde el panel de Usuarios", () => {
    expect(STAFF_ROLES).toContain("jefe_zona");
  });

  it("no es staff de Legal, ni admin, ni solicitante", () => {
    expect(LEGAL_STAFF_ROLES).not.toContain("jefe_zona");
    expect(isAdminRole("jefe_zona")).toBe(false);
    expect(isSolicitanteRole("jefe_zona")).toBe(false);
  });
});

describe("sitios", () => {
  it("esSitios solo es verdadero para ese rol", () => {
    expect(esSitios("sitios")).toBe(true);
    expect(esSitios("jefe_zona")).toBe(false);
    expect(esSitios(null)).toBe(false);
    expect(esSitios(undefined)).toBe(false);
  });

  it("se crea con correo y contrasena desde el panel de Usuarios", () => {
    expect(STAFF_ROLES).toContain("sitios");
  });

  it("no es staff de Legal, ni admin, ni solicitante", () => {
    expect(LEGAL_STAFF_ROLES).not.toContain("sitios");
    expect(isAdminRole("sitios")).toBe(false);
    expect(isSolicitanteRole("sitios")).toBe(false);
  });
});

describe("roles de solo resumen", () => {
  it("jefe_zona y sitios consultan solo el resumen del contrato", () => {
    expect(ROLES_SOLO_RESUMEN).toEqual(["jefe_zona", "sitios"]);
    expect(esRolSoloResumen("jefe_zona")).toBe(true);
    expect(esRolSoloResumen("sitios")).toBe(true);
    expect(esRolSoloResumen("admin")).toBe(false);
    expect(esRolSoloResumen("gerente_area")).toBe(false);
    expect(esRolSoloResumen(null)).toBe(false);
  });

  it("solo el jefe de zona da visto bueno", () => {
    expect(puedeDarVistoBueno("jefe_zona")).toBe(true);
    expect(puedeDarVistoBueno("sitios")).toBe(false);
    expect(puedeDarVistoBueno("admin")).toBe(false);
    expect(puedeDarVistoBueno(null)).toBe(false);
  });
});

describe("puedeVerDashboard", () => {
  it.each<[Role, boolean]>([
    ["solicitante", false],
    ["gerente_area", false],
    ["mesa_control", true],
    ["abogado", true],
    ["gerente_juridico", true],
    ["admin", true],
    ["jefe_zona", false],
    ["sitios", false],
  ])("%s -> %s", (role, esperado) => {
    expect(puedeVerDashboard(role)).toBe(esperado);
  });

  it("un rol ausente no ve el dashboard", () => {
    expect(puedeVerDashboard(null)).toBe(false);
    expect(puedeVerDashboard(undefined)).toBe(false);
  });
});
