const LOCALE = "es-MX";

export function sanitizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function formatMonedaMXN(valor: number): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "MXN" }).format(valor);
}

// Enmascara un monto mientras se escribe: digitos, 1 punto, max 2 decimales, comas de millar.
export function formatMontoInput(value: string): string {
  const limpio = value.replace(/[^\d.]/g, "");
  const puntoIdx = limpio.indexOf(".");
  const entero = puntoIdx === -1 ? limpio : limpio.slice(0, puntoIdx);
  const decimales = puntoIdx === -1 ? "" : limpio.slice(puntoIdx + 1).replace(/\./g, "").slice(0, 2);

  const enteroSinCeros = entero.replace(/^0+(?=\d)/, "");
  const enteroConComas = enteroSinCeros.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return puntoIdx === -1 ? enteroConComas : `${enteroConComas}.${decimales}`;
}

export function parseMontoInput(value: string): number {
  return Number(value.replace(/,/g, ""));
}

export function toTitleCase(value: string): string {
  const limpio = sanitizeSpaces(value);
  if (!limpio) return limpio;

  return limpio
    .split(" ")
    .map((palabra) =>
      palabra.length
        ? palabra[0].toLocaleUpperCase(LOCALE) + palabra.slice(1).toLocaleLowerCase(LOCALE)
        : palabra
    )
    .join(" ");
}

// Evita la bandera "u" de /\p{L}/ (no permitida sin target es6+); tambien cubre acentos.
function esLetra(c: string): boolean {
  return c.toLocaleUpperCase(LOCALE) !== c.toLocaleLowerCase(LOCALE);
}

export function toSentenceCase(value: string): string {
  const limpio = sanitizeSpaces(value);
  if (!limpio) return limpio;

  const caracteres = Array.from(limpio.toLocaleLowerCase(LOCALE));
  let capitalizarSiguiente = true;

  for (let i = 0; i < caracteres.length; i++) {
    const c = caracteres[i];
    if (capitalizarSiguiente && esLetra(c)) {
      caracteres[i] = c.toLocaleUpperCase(LOCALE);
      capitalizarSiguiente = false;
    } else if (c === "." || c === "!" || c === "?") {
      capitalizarSiguiente = true;
    }
  }

  return caracteres.join("");
}
