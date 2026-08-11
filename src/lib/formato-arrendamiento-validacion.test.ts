import { describe, it, expect } from "vitest";
import { validarTextoFormatoArrendamiento } from "./formato-arrendamiento-validacion";

const TEXTO_OFICIAL_COMPLETO = `
  FORMATO BASE DE SOLICITUD PARA ELABORACIÓN DE CONTRATO DE ARRENDAMIENTO
  1. DATOS DEL SOLICITANTE
  2. DATOS DEL ARRENDAMIENTO
  3. DOCUMENTACIÓN REQUERIDA (CHECKLIST)
  4. AUTORIZACIÓN DEL ÁREA
`;

describe("validarTextoFormatoArrendamiento", () => {
  it("acepta el texto del formato oficial con los 4 encabezados", () => {
    expect(validarTextoFormatoArrendamiento(TEXTO_OFICIAL_COMPLETO)).toBe(true);
  });

  it("acepta si solo faltan 1 de los 4 encabezados (llegan al minimo de 3)", () => {
    const sinUno = TEXTO_OFICIAL_COMPLETO.replace("AUTORIZACIÓN DEL ÁREA", "");
    expect(validarTextoFormatoArrendamiento(sinUno)).toBe(true);
  });

  it("rechaza un texto que solo trae 2 de los 4 encabezados", () => {
    const soloDoles = "FORMATO BASE DE SOLICITUD ... DATOS DEL ARRENDAMIENTO";
    expect(validarTextoFormatoArrendamiento(soloDoles)).toBe(false);
  });

  it("rechaza el texto de un documento totalmente distinto", () => {
    expect(validarTextoFormatoArrendamiento("Contrato de compraventa de equipo de computo")).toBe(false);
  });

  it("tolera espacios/saltos de linea extra entre las palabras de un encabezado", () => {
    const conEspaciosRaros = "FORMATO   BASE\nDE SOLICITUD ... DATOS DEL ARRENDAMIENTO ... DOCUMENTACION REQUERIDA";
    expect(validarTextoFormatoArrendamiento(conEspaciosRaros)).toBe(true);
  });

  it("es insensible a mayusculas/minusculas", () => {
    const minusculas = "formato base de solicitud ... datos del arrendamiento ... documentacion requerida";
    expect(validarTextoFormatoArrendamiento(minusculas)).toBe(true);
  });
});
