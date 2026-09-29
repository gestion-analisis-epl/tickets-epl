import { describe, expect, it } from "vitest";
import {
  aplicarSeleccion, campoBloqueado, filtrarOpciones, opcionesCampo, parseFilasSitios, SELECCION_VACIA,
  siguienteAncla, sitioDeSeleccion, type Sitio,
} from "./sitios-rules";

const SITIOS: Sitio[] = [
  { clave: "C1", alias: "Alias A" },
  { clave: "C2", alias: "Alias B" },
  { clave: "C3", alias: "Alias C" },
  { clave: "C4", alias: "Repetido" },
  { clave: "C5", alias: "Repetido" },
  { clave: "C6", alias: "Doble 1" },
  { clave: "C6", alias: "Doble 2" },
];

describe("parseFilasSitios", () => {
  const ENC = ["anun_ID", "anun_Clave", "anun_Alias", "anun_Vista"];

  it("mapea las columnas por encabezado sin importar el orden e ignora las demas", () => {
    const filas = [
      ["anun_Vista", "anun_ID", "anun_Alias", "anun_Clave", "otra"],
      ["Norte", "10", "Alias X", "CX", "x"],
    ];
    expect(parseFilasSitios(filas)).toEqual([{ clave: "CX", alias: "Alias X" }]);
  });

  it("solo exige las columnas de clave y alias", () => {
    expect(parseFilasSitios([["anun_Clave", "anun_Alias"], ["C1", "A"]])).toEqual([{ clave: "C1", alias: "A" }]);
  });

  it("recorta espacios y descarta filas sin clave o sin alias", () => {
    const filas = [
      ENC,
      ["1", " C1 ", " Alias A ", "Norte"],
      ["2", "", "Sin clave", "Sur"],
      ["3", "C3", "", "Sur"],
      [],
    ];
    expect(parseFilasSitios(filas)).toEqual([{ clave: "C1", alias: "Alias A" }]);
  });

  it("acepta filas cortas (celdas finales vacias que Sheets omite)", () => {
    expect(parseFilasSitios([ENC, ["1", "C1", "Alias A"]])).toEqual([{ clave: "C1", alias: "Alias A" }]);
  });

  it("junta en un solo sitio las filas con la misma clave y alias (una por cada vista)", () => {
    const filas = [
      ENC,
      ["1", "C1", "Alias A", "Norte"],
      ["2", "C1", "Alias A", "Sur"],
      ["3", "C1", "Alias A", "Centro"],
    ];
    expect(parseFilasSitios(filas)).toEqual([{ clave: "C1", alias: "Alias A" }]);
  });

  it("falla con un mensaje claro si falta una columna necesaria", () => {
    expect(() => parseFilasSitios([["anun_ID", "anun_Clave"], ["1", "C1"]])).toThrow(/anun_Alias/);
    expect(() => parseFilasSitios([["anun_ID", "anun_Alias"], ["1", "A"]])).toThrow(/anun_Clave/);
  });

  it("devuelve lista vacia si la hoja no tiene filas", () => {
    expect(parseFilasSitios([])).toEqual([]);
  });

  describe("normalizacion", () => {
    const parse = (...filas: string[][]) => parseFilasSitios([ENC, ...filas]);

    it("colapsa espacios repetidos dentro del alias y de la clave", () => {
      const [sitio] = parse(["1", " GENE   1 ", "Las  Cazuelas   Unipolar", "N"]);
      expect(sitio).toEqual({ clave: "GENE 1", alias: "Las Cazuelas Unipolar" });
    });

    it("fusiona alias que difieren solo en acentos, usando la forma mas frecuente", () => {
      const sitios = parse(
        ["1", "C1", "GENERICO", "N"],
        ["2", "C2", "GENÉRICO", "N"],
        ["3", "C3", "GENERICO", "N"]
      );
      expect(sitios.map((s) => s.alias)).toEqual(["GENERICO", "GENERICO", "GENERICO"]);
    });

    it("fusiona alias que difieren en mayusculas y en espacios", () => {
      const sitios = parse(
        ["1", "C1", "LAS CAZUELAS  UNIPOLAR", "N"],
        ["2", "C2", "LAS CAZUELAS UNIPOLAR", "N"],
        ["3", "C3", "Las Cazuelas Unipolar", "N"]
      );
      expect(new Set(sitios.map((s) => s.alias)).size).toBe(1);
    });

    it("en un empate conserva la forma que aparece primero", () => {
      const sitios = parse(["1", "C1", "GENÉRICO", "N"], ["2", "C2", "GENERICO", "N"]);
      expect(sitios.map((s) => s.alias)).toEqual(["GENÉRICO", "GENÉRICO"]);
    });

    it("no fusiona alias realmente distintos", () => {
      const sitios = parse(["1", "C1", "Plaza Norte", "N"], ["2", "C2", "Plaza Sur", "N"]);
      expect(new Set(sitios.map((s) => s.alias)).size).toBe(2);
    });

    it("de las claves solo colapsa espacios: no quita acentos ni cambia mayusculas", () => {
      const sitios = parse(["1", "C1", "A", "N"], ["2", "c1", "A", "N"]);
      expect(sitios.map((s) => s.clave)).toEqual(["C1", "c1"]);
    });

    it("tras unificar, una clave bajo dos variantes del mismo alias queda como un solo sitio", () => {
      const sitios = parse(["1", "GENE34", "GENERICO", "N"], ["2", "GENE34", "GENÉRICO", "S"]);
      expect(sitios).toEqual([{ clave: "GENE34", alias: "GENERICO" }]);
    });
  });
});

describe("aplicarSeleccion", () => {
  it("al elegir una clave con un solo alias llena el alias", () => {
    expect(aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C1")).toEqual({ clave: "C1", alias: "Alias A" });
  });

  it("al elegir un alias con una sola clave llena la clave", () => {
    expect(aplicarSeleccion(SITIOS, SELECCION_VACIA, "alias", "Alias B")).toEqual({ clave: "C2", alias: "Alias B" });
  });

  it("un alias con varias claves deja la clave pendiente hasta elegirla", () => {
    const paso1 = aplicarSeleccion(SITIOS, SELECCION_VACIA, "alias", "Repetido");
    expect(paso1).toEqual({ clave: "", alias: "Repetido" });
    expect(aplicarSeleccion(SITIOS, paso1, "clave", "C5")).toEqual({ clave: "C5", alias: "Repetido" });
  });

  it("una clave con varios alias deja el alias pendiente hasta elegirlo", () => {
    const paso1 = aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C6");
    expect(paso1).toEqual({ clave: "C6", alias: "" });
    expect(aplicarSeleccion(SITIOS, paso1, "alias", "Doble 2")).toEqual({ clave: "C6", alias: "Doble 2" });
  });

  it("al cambiar de clave descarta un alias que ya no le corresponde", () => {
    const completo = aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C1");
    expect(aplicarSeleccion(SITIOS, completo, "clave", "C2")).toEqual({ clave: "C2", alias: "Alias B" });
  });

  it("al cambiar a una clave con varios alias limpia el alias anterior", () => {
    const completo = aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C1");
    expect(aplicarSeleccion(SITIOS, completo, "clave", "C6")).toEqual({ clave: "C6", alias: "" });
  });

  it("conserva el alias si tambien existe bajo la nueva clave", () => {
    const paso1 = aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C6");
    const completo = aplicarSeleccion(SITIOS, paso1, "alias", "Doble 1");
    expect(aplicarSeleccion(SITIOS, completo, "clave", "C6")).toEqual({ clave: "C6", alias: "Doble 1" });
  });

  it("vaciar un campo no vuelve a deducir el otro", () => {
    const completo = aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C3");
    expect(aplicarSeleccion(SITIOS, completo, "alias", "")).toEqual({ clave: "C3", alias: "" });
  });
});

describe("opcionesCampo", () => {
  it("sin seleccion lista todos los valores unicos ordenados", () => {
    expect(opcionesCampo(SITIOS, SELECCION_VACIA, "clave")).toEqual(["C1", "C2", "C3", "C4", "C5", "C6"]);
    expect(opcionesCampo(SITIOS, SELECCION_VACIA, "alias")).toEqual([
      "Alias A", "Alias B", "Alias C", "Doble 1", "Doble 2", "Repetido",
    ]);
  });

  it("estrecha los alias a los de la clave elegida", () => {
    const sel = aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C6");
    expect(opcionesCampo(SITIOS, sel, "alias")).toEqual(["Doble 1", "Doble 2"]);
  });

  it("estrecha las claves a las del alias elegido", () => {
    const sel = aplicarSeleccion(SITIOS, SELECCION_VACIA, "alias", "Repetido");
    expect(opcionesCampo(SITIOS, sel, "clave")).toEqual(["C4", "C5"]);
  });

  it("con el sitio ya resuelto no restringe ningun campo", () => {
    const sel = aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C3");
    expect(opcionesCampo(SITIOS, sel, "clave")).toHaveLength(6);
    expect(opcionesCampo(SITIOS, sel, "alias")).toHaveLength(6);
  });
});

describe("sitioDeSeleccion", () => {
  it("devuelve el sitio cuando la seleccion esta completa y existe", () => {
    const sel = aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C3");
    expect(sitioDeSeleccion(SITIOS, sel)).toEqual({ clave: "C3", alias: "Alias C" });
  });

  it("devuelve null si la seleccion esta incompleta", () => {
    expect(sitioDeSeleccion(SITIOS, aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C6"))).toBeNull();
  });

  it("devuelve null si el par ya no existe en la hoja", () => {
    expect(sitioDeSeleccion(SITIOS, { clave: "C1", alias: "Alias B" })).toBeNull();
    expect(sitioDeSeleccion(SITIOS, { clave: "C9", alias: "X" })).toBeNull();
  });
});

describe("filtrarOpciones", () => {
  const opciones = ["Plaza Central", "Avenida Reforma", "Bosque de Chapultepec", "Zona Águila"];

  it("sin texto devuelve todas", () => {
    expect(filtrarOpciones(opciones, "")).toEqual(opciones);
    expect(filtrarOpciones(opciones, "   ")).toEqual(opciones);
  });

  it("busca por fragmento ignorando mayusculas", () => {
    expect(filtrarOpciones(opciones, "REFORMA")).toEqual(["Avenida Reforma"]);
  });

  it("ignora acentos en la busqueda y en las opciones", () => {
    expect(filtrarOpciones(opciones, "aguila")).toEqual(["Zona Águila"]);
    expect(filtrarOpciones(opciones, "águila")).toEqual(["Zona Águila"]);
  });

  it("todas las palabras deben aparecer, en cualquier orden", () => {
    expect(filtrarOpciones(opciones, "central plaza")).toEqual(["Plaza Central"]);
    expect(filtrarOpciones(opciones, "plaza reforma")).toEqual([]);
  });
});

describe("siguienteAncla", () => {
  it.each([
    [null, "clave", "C1", "clave"],
    [null, "alias", "Alias A", "alias"],
    ["clave", "alias", "Alias A", "clave"],
    ["alias", "clave", "C1", "alias"],
    ["clave", "clave", "", null],
    ["alias", "alias", "", null],
    ["clave", "alias", "", "clave"],
  ] as const)("ancla %s + cambio en %s=%s -> %s", (ancla, campo, valor, esperada) => {
    expect(siguienteAncla(ancla, campo, valor)).toBe(esperada);
  });
});

describe("campoBloqueado", () => {
  it("con la clave como ancla se bloquea el alias derivado, no la clave", () => {
    const sel = aplicarSeleccion(SITIOS, SELECCION_VACIA, "clave", "C1");
    expect(campoBloqueado(sel, "clave", "alias")).toBe(true);
    expect(campoBloqueado(sel, "clave", "clave")).toBe(false);
  });

  it("con el alias como ancla se bloquea la clave derivada, no el alias", () => {
    const sel = aplicarSeleccion(SITIOS, SELECCION_VACIA, "alias", "Alias A");
    expect(campoBloqueado(sel, "alias", "clave")).toBe(true);
    expect(campoBloqueado(sel, "alias", "alias")).toBe(false);
  });

  it("si el alias ancla no permite derivar la clave, la clave sigue libre", () => {
    const sel = aplicarSeleccion(SITIOS, SELECCION_VACIA, "alias", "Repetido");
    expect(campoBloqueado(sel, "alias", "clave")).toBe(false);
  });

  it("una vez elegida la clave del alias ambiguo, esa clave queda bloqueada", () => {
    const paso1 = aplicarSeleccion(SITIOS, SELECCION_VACIA, "alias", "Repetido");
    const paso2 = aplicarSeleccion(SITIOS, paso1, "clave", "C4");
    expect(campoBloqueado(paso2, "alias", "clave")).toBe(true);
    expect(campoBloqueado(paso2, "alias", "alias")).toBe(false);
  });

  it("sin ancla y con el sitio completo (ticket existente) se bloquean clave y alias", () => {
    const sel = { clave: "C3", alias: "Alias C" };
    expect(campoBloqueado(sel, null, "clave")).toBe(true);
    expect(campoBloqueado(sel, null, "alias")).toBe(true);
  });

  it("sin ancla y con el sitio incompleto no se bloquea nada", () => {
    expect(campoBloqueado({ clave: "C6", alias: "" }, null, "clave")).toBe(false);
  });

  it("una ancla que ya no tiene valor (seleccion limpiada desde fuera) se ignora", () => {
    expect(campoBloqueado(SELECCION_VACIA, "clave", "alias")).toBe(false);
  });
});
