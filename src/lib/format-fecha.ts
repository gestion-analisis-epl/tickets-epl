const ZONA_HORARIA = "America/Mexico_City";

export function formatFecha(iso: string | null | undefined, opts?: { conHora?: boolean }): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA_HORARIA,
    year: "numeric", month: "short", day: "numeric",
    ...(opts?.conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}
