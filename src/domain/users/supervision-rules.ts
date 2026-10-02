export type ResultadoSupervision = { ok: true; uids: string[] } | { ok: false; error: string };

// Valida la lista de usuarios que un gerente de area podra ver (viene del panel de usuarios).
export function normalizarSupervisaUids(
  entrada: unknown,
  { propioUid, uidsExistentes }: { propioUid: string; uidsExistentes: Set<string> }
): ResultadoSupervision {
  if (!Array.isArray(entrada)) return { ok: false, error: "supervisaUids debe ser una lista." };
  if (entrada.some((u) => typeof u !== "string")) return { ok: false, error: "supervisaUids solo admite identificadores de usuario." };

  const uids = Array.from(new Set((entrada as string[]).map((u) => u.trim()).filter(Boolean)));
  if (uids.includes(propioUid)) return { ok: false, error: "Un usuario no puede supervisarse a si mismo." };

  const desconocido = uids.find((u) => !uidsExistentes.has(u));
  if (desconocido) return { ok: false, error: `Usuario no encontrado: ${desconocido}.` };

  return { ok: true, uids };
}

interface UsuarioSupervisor {
  role?: string;
  activo?: boolean;
  email?: string;
  supervisaUids?: string[];
}

// Correos de los gerentes de area activos que supervisan al solicitante de un ticket.
export function gerentesQueSupervisan(usuarios: UsuarioSupervisor[], solicitanteId: string): string[] {
  const emails = usuarios
    .filter((u) => u.role === "gerente_area" && u.activo && u.email && u.supervisaUids?.includes(solicitanteId))
    .map((u) => u.email as string);
  return Array.from(new Set(emails));
}
