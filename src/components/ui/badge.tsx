import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Excepcion acordada al minimo de contraste 10:1: estos badges usan la
 * paleta pastel de KRONOS (fondo tenue + texto de color) por consistencia
 * visual entre ambos sistemas. El resto de la UI si cumple 10:1.
 */
export type BadgeTone =
  | "gray" | "blue" | "indigo" | "purple" | "teal" | "green" | "amber" | "orange" | "red";

const TONE_CLASSES: Record<BadgeTone, string> = {
  gray:   "bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:ring-gray-500/25",
  blue:   "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25",
  indigo: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25",
  purple: "bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-500/25",
  teal:   "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/25",
  green:  "bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-500/25",
  amber:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25",
  orange: "bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/25",
  red:    "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25",
};

export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap", TONE_CLASSES[tone])}>
      {children}
    </span>
  );
}

// Mismo tono que el badge, pero para pintar una superficie mas grande (ej. una
// columna de kanban) — mas tenue que el badge para que siga siendo legible en
// un area grande, no solo en una pildora chica.
export const TONE_SURFACE_CLASSES: Record<BadgeTone, string> = {
  gray:   "bg-gray-50 border-gray-200 dark:bg-gray-500/10 dark:border-gray-500/20",
  blue:   "bg-blue-50/70 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20",
  indigo: "bg-indigo-50/70 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20",
  purple: "bg-purple-50/70 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/20",
  teal:   "bg-teal-50/70 border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/20",
  green:  "bg-green-50/70 border-green-200 dark:bg-green-500/10 dark:border-green-500/20",
  amber:  "bg-amber-50/70 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20",
  orange: "bg-orange-50/70 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20",
  red:    "bg-red-50/70 border-red-200 dark:bg-red-500/10 dark:border-red-500/20",
};

// ── Estatus del ticket (7 etapas, hoja Listas) ───────────────────────────────

export const ESTATUS_TONE: Record<string, BadgeTone> = {
  "Recepcion de solicitud":                       "gray",
  "Validacion de informacion con solicitante":     "amber",
  "Proyeccion de nivel de servicio (SLA)":         "purple",
  "Asignacion de responsable":                     "indigo",
  "Proceso en tramite":                            "blue",
  "Validacion y presentacion de requerimiento":    "teal",
  "Cierre":                                        "green",
};

export function EstatusBadge({ estatus }: { estatus: string }) {
  return <Badge tone={ESTATUS_TONE[estatus] ?? "gray"}>{estatus}</Badge>;
}

// ── Categoria del servicio (hoja Catalogo) ───────────────────────────────────

export const CATEGORIA_TONE: Record<string, BadgeTone> = {
  "Contratos":                 "blue",
  "Licencias y permisos":      "teal",
  "Control documental":        "gray",
  "Servicios extraordinarios": "orange",
};

export function CategoriaBadge({ categoria }: { categoria: string }) {
  return <Badge tone={CATEGORIA_TONE[categoria] ?? "gray"}>{categoria}</Badge>;
}
