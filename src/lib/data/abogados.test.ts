import { describe, expect, it } from "vitest";
import { partesAbogado } from "./abogados";

describe("partesAbogado", () => {
  it("separa nombre, puesto y zona de un regional", () => {
    expect(partesAbogado("Alberto Gonzalez - Regional - Puebla-Sur")).toEqual({ nombre: "Alberto Gonzalez", puesto: "Regional", zona: "Puebla-Sur" });
  });

  it("deja la zona vacia si el abogado no tiene", () => {
    expect(partesAbogado("Karina Valenzuela - Abogado Corporativo")).toEqual({ nombre: "Karina Valenzuela", puesto: "Abogado Corporativo", zona: "" });
  });

  it("muestra el texto tal cual si no esta en el catalogo", () => {
    expect(partesAbogado("Alguien Historico")).toEqual({ nombre: "Alguien Historico", puesto: "", zona: "" });
  });

  it("devuelve Sin asignar cuando no hay abogado", () => {
    expect(partesAbogado(null)).toEqual({ nombre: "Sin asignar", puesto: "", zona: "" });
  });
});
