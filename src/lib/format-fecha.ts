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
