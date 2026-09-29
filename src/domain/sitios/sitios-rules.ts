// Catalogo de sitios que vive en Google Sheets (columnas anun_Clave y anun_Alias; la hoja trae
// ademas anun_ID y anun_Vista, que no se usan). Un sitio es el par (clave, alias): las filas que
// solo difieren en la vista se juntan en uno.

export interface Sitio {
  clave: string;
  alias: string;
}

export type CampoSitio = "clave" | "alias";

// Un campo vacio = seleccion incompleta (falta elegirlo o hay ambiguedad).
export type SeleccionSitio = Sitio;

export const SELECCION_VACIA: SeleccionSitio = { clave: "", alias: "" };

const CAMPOS: CampoSitio[] = ["clave", "alias"];

const ENCABEZADOS = { clave: "anun_Clave", alias: "anun_Alias" } as const;

function texto(celda: unknown): string {
  return celda == null ? "" : String(celda).replace(/\s+/g, " ").trim();
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Alias que difieren solo en acentos, mayusculas o espacios son el mismo valor: se unifican en
// la forma mas frecuente (en empate, la que aparece primero en la hoja).
function unificarAlias(sitios: Sitio[]): void {
  const formas = new Map<string, Map<string, { cuenta: number; orden: number }>>();
  let orden = 0;
  for (const s of sitios) {
    const llave = normalizar(s.alias);
    const grupo = formas.get(llave) ?? new Map();
    const forma = grupo.get(s.alias) ?? { cuenta: 0, orden: orden++ };
    forma.cuenta++;
    grupo.set(s.alias, forma);
    formas.set(llave, grupo);
  }

  const canonica = new Map<string, string>();
  formas.forEach((grupo, llave) => {
    const [mejor] = Array.from(grupo).sort(([, a], [, b]) => b.cuenta - a.cuenta || a.orden - b.orden);
    canonica.set(llave, mejor[0]);
  });
  for (const s of sitios) s.alias = canonica.get(normalizar(s.alias))!;
}

// La primera fila son los encabezados. Sheets omite las celdas vacias del final de cada fila.
export function parseFilasSitios(filas: unknown[][]): Sitio[] {
  if (filas.length === 0) return [];

  const encabezados = filas[0].map((c) => texto(c).toLowerCase());
  const indice = {} as Record<CampoSitio, number>;
  for (const campo of CAMPOS) {
    const i = encabezados.indexOf(ENCABEZADOS[campo].toLowerCase());
    if (i === -1) throw new Error(`La hoja de sitios no tiene la columna ${ENCABEZADOS[campo]}.`);
    indice[campo] = i;
  }

  const candidatos: Sitio[] = [];
  for (const fila of filas.slice(1)) {
    const sitio: Sitio = { clave: texto(fila[indice.clave]), alias: texto(fila[indice.alias]) };
    if (sitio.clave && sitio.alias) candidatos.push(sitio);
  }
  unificarAlias(candidatos);

  // Se junta despues de unificar: dos variantes del mismo alias bajo una clave son un solo sitio.
  const vistos = new Set<string>();
  return candidatos.filter((s) => {
    const llave = `${s.clave}\u0000${s.alias}`;
    if (vistos.has(llave)) return false;
    vistos.add(llave);
    return true;
  });
}

type Filtro = Partial<Record<CampoSitio, string>>;

function coincide(sitio: Sitio, filtro: Filtro): boolean {
  return CAMPOS.every((c) => !filtro[c] || sitio[c] === filtro[c]);
}

function estaCompleta(seleccion: SeleccionSitio): boolean {
  return !!seleccion.clave && !!seleccion.alias;
}

// Aplica un cambio en un campo y completa el otro si solo hay una posibilidad. El otro campo se
// conserva solo si sigue siendo compatible con el nuevo valor.
export function aplicarSeleccion(
  sitios: Sitio[],
  actual: SeleccionSitio,
  campo: CampoSitio,
  valor: string
): SeleccionSitio {
  const otro: CampoSitio = campo === "clave" ? "alias" : "clave";
  const conserva = !!valor && !!actual[otro] && sitios.some((s) => coincide(s, { [campo]: valor, [otro]: actual[otro] }));

  // Al vaciar un campo no se vuelve a deducir nada: el usuario esta corrigiendo.
  if (!valor) return { ...actual, [campo]: "" };
  if (conserva) return { ...actual, [campo]: valor };

  const candidatos = sitios.filter((s) => coincide(s, { [campo]: valor }));
  return candidatos.length === 1 ? { ...candidatos[0] } : { ...SELECCION_VACIA, [campo]: valor };
}

// Valores posibles de un campo dado lo elegido en el otro. Con el sitio resuelto no se restringe
// nada, para poder cambiar de sitio sin limpiar antes.
export function opcionesCampo(sitios: Sitio[], seleccion: SeleccionSitio, campo: CampoSitio): string[] {
  const otro: CampoSitio = campo === "clave" ? "alias" : "clave";
  const filtro: Filtro = estaCompleta(seleccion) ? {} : { [otro]: seleccion[otro] };
  const valores = new Set<string>();
  for (const s of sitios) if (coincide(s, filtro)) valores.add(s[campo]);
  return Array.from(valores).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

// Devuelve el sitio solo si la seleccion esta completa y el par sigue existiendo en la hoja.
export function sitioDeSeleccion(sitios: Sitio[], seleccion: SeleccionSitio): Sitio | null {
  if (!estaCompleta(seleccion)) return null;
  return sitios.find((s) => s.clave === seleccion.clave && s.alias === seleccion.alias) ?? null;
}

// Buscador de los dropdowns: sin acentos ni mayusculas, y todas las palabras deben aparecer.
export function filtrarOpciones(opciones: string[], busqueda: string): string[] {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return opciones;
  return opciones.filter((o) => {
    const n = normalizar(o);
    return palabras.every((p) => n.includes(p));
  });
}

// El ancla es el primero que el usuario elige; el otro campo se deriva y se bloquea.
export type AnclaSitio = CampoSitio | null;

export function siguienteAncla(ancla: AnclaSitio, campo: CampoSitio, valor: string): AnclaSitio {
  if (!valor) return campo === ancla ? null : ancla;
  return ancla ?? campo;
}

// Sin ancla (ticket que ya traia sitio) se bloquean ambos mientras el sitio este completo;
// para cambiar de sitio hay que limpiar.
export function campoBloqueado(seleccion: SeleccionSitio, ancla: AnclaSitio, campo: CampoSitio): boolean {
  if (!seleccion[campo]) return false;
  const anclaEfectiva = ancla && seleccion[ancla] ? ancla : null;
  return anclaEfectiva ? campo !== anclaEfectiva : estaCompleta(seleccion);
}
