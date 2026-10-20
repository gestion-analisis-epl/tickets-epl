import { describe, it, expect } from "vitest";
import { validarSolicitud, type SolicitudCapturada } from "./nuevo-ticket-validacion";

const CONTRATO_OK = {
  domicilio: "Av. Reforma 1", altaArrendador: "Juan Perez", solicitante: "Ana Lopez",
  periodoInicio: "2026-01-01", periodoFin: "2027-01-01", condicionesCodigo: "63", condicionesTipo: "Transferencia",
  montoPago: "12,500.00", motivo: "Alta de Arrendador",
};

const BASE: SolicitudCapturada = {
  areaEmpresa: "Grupo EPL", servicioId: "JUR-C071", descripcion: "Alta", sitioListo: true,
  requiereFormato: true, formatoListo: true, documentacionObligatoria: true, documentacionListos: 1, documentosFaltantes: [],
  requiereDatosContrato: true, contrato: CONTRATO_OK,
};

describe("validarSolicitud", () => {
  it("una solicitud completa no tiene errores", () => {
    expect(validarSolicitud(BASE)).toEqual({});
  });

  it("exige cada documento individual que falte", () => {
    const e = validarSolicitud({ ...BASE, documentacionObligatoria: false, documentacionListos: 0, documentosFaltantes: [{ key: "predial", label: "Predial" }] });
    expect(e.predial).toMatch(/Predial/);
    expect(e.documentacion).toBeUndefined();
  });

  it("exige el formato y al menos un archivo de documentacion cuando el servicio lo requiere", () => {
    const e = validarSolicitud({ ...BASE, formatoListo: false, documentacionListos: 0 });
    expect(e.formato).toBeTruthy();
    expect(e.documentacion).toBeTruthy();
  });

  it("no exige formato ni documentacion si el servicio no los requiere", () => {
    const e = validarSolicitud({ ...BASE, requiereFormato: false, formatoListo: false, documentacionObligatoria: false, documentacionListos: 0 });
    expect(e.formato).toBeUndefined();
    expect(e.documentacion).toBeUndefined();
  });

  it("exige los datos del contrato, incluido el motivo sin preseleccion", () => {
    const e = validarSolicitud({ ...BASE, contrato: { ...CONTRATO_OK, domicilio: "", motivo: "", montoPago: "0" } });
    expect(e.domicilio).toBeTruthy();
    expect(e.motivo).toBeTruthy();
    expect(e.montoPago).toBeTruthy();
  });

  it("rechaza un periodo con fin anterior al inicio", () => {
    const e = validarSolicitud({ ...BASE, contrato: { ...CONTRATO_OK, periodoFin: "2025-01-01" } });
    expect(e.periodoFin).toMatch(/anterior/);
  });

  it("no valida el contrato si el servicio no lo captura", () => {
    const vacio = { ...CONTRATO_OK, domicilio: "", motivo: "" };
    expect(validarSolicitud({ ...BASE, requiereDatosContrato: false, contrato: vacio })).toEqual({});
  });

  it("exige area, servicio, descripcion y sitio", () => {
    const e = validarSolicitud({ ...BASE, areaEmpresa: "", descripcion: " ", sitioListo: false });
    expect(Object.keys(e)).toEqual(expect.arrayContaining(["areaEmpresa", "descripcion", "sitio"]));
  });
});
