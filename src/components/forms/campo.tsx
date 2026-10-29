import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampoProps {
  // Es el id del control (input, select, textarea) que va dentro: enlaza la etiqueta con el campo.
  id: string;
  etiqueta: string;
  obligatorio?: boolean;
  ayuda?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

// Un dato por campo: etiqueta completa, marca de obligatorio u opcional, ayuda corta y error legible.
export function Campo({ id, etiqueta, obligatorio = true, ayuda, error, className, children }: CampoProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="field-label">
        {etiqueta}
        {obligatorio ? (
          <>
            {" "}<span className="text-danger" aria-hidden="true">*</span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        ) : (
          <span className="ml-2 rounded-full border border-border px-2 py-px text-xs font-medium text-muted">Opcional</span>
        )}
      </label>
      {children}
      {ayuda && <p className="text-xs text-muted mt-1.5">{ayuda}</p>}
      {error && (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
