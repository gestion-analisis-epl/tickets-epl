import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { textoFaltan, type SeccionAvance } from "@/domain/tickets/avance-formulario";

interface RielAvanceProps {
  secciones: SeccionAvance[];
  // Con errores a la vista, las secciones incompletas se marcan en rojo.
  resaltarFaltantes: boolean;
}

// "Tu avance": barra horizontal que se queda arriba mientras se baja por el formulario. Cada paso lleva a su seccion.
export function RielAvance({ secciones, resaltarFaltantes }: RielAvanceProps) {
  return (
    <nav
      aria-label="Tu avance"
      className="sticky top-14 z-10 mb-5 flex items-center gap-x-5 gap-y-2 overflow-x-auto rounded-md border border-border bg-card px-4 py-2.5 shadow-[0_1px_0_hsl(var(--border))]"
    >
      <p className="eyebrow shrink-0">Tu avance</p>
      <ol className="flex flex-1 flex-wrap items-center gap-x-1 gap-y-1">
        {secciones.map((s, i) => {
          const listo = s.faltan === 0;
          return (
            <li key={s.id} className="shrink-0">
              <a href={`#${s.id}`} className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-surface">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums",
                    listo ? "border-success bg-success text-success-foreground"
                      : resaltarFaltantes ? "border-danger text-danger" : "border-input"
                  )}
                >
                  {listo ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="leading-tight">
                  <span className="block font-medium">{s.titulo}</span>
                  <span className="block text-xs text-muted">{textoFaltan(s.faltan)}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
