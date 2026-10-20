const ZONA_HORARIA = "America/Mexico_City";

export function formatFecha(iso: string | null | undefined, opts?: { conHora?: boolean }): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA_HORARIA,
    year: "numeric", month: "short", day: "numeric",
    ...(opts?.conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}

// Para yyyy-mm-dd: NO usar formatFecha, que parsea como UTC y retrocede un dia.
export function formatFechaSolo(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(anio, mes - 1, dia)
  );
}

// dd/mm/aaaa HH:mm (24 h) en hora de Ciudad de Mexico, para registros como el historial.
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("es-MX", {
      timeZone: ZONA_HORARIA,
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(fecha).map((p) => [p.type, p.value])
  );
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}`;
}

const RE_FECHA_HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const RE_FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

// Valores guardados como texto en el historial: las fechas ISO se muestran como dd/mm/aaaa [HH:mm].
export function textoLegibleDeValor(valor: string | null): string | null {
  if (!valor) return valor;
  if (RE_FECHA_HORA_ISO.test(valor)) return formatFechaHora(valor);
  const soloFecha = RE_FECHA_ISO.exec(valor);
  return soloFecha ? `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}` : valor;
}
