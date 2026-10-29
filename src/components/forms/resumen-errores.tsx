import { AlertCircle } from "lucide-react";
import { textoFaltan, totalFaltantes, type SeccionAvance } from "@/domain/tickets/avance-formulario";

interface ResumenErroresProps {
  secciones: SeccionAvance[];
  visible: boolean;
}

// Aviso al inicio del formulario con enlaces a lo que falta; el formulario lo enfoca al intentar enviar.
export function ResumenErrores({ secciones, visible }: ResumenErroresProps) {
  const total = totalFaltantes(secciones);
  if (!visible || total === 0) return null;

  return (
    <div
      id="resumen-errores"
      role="alert"
      tabIndex={-1}
      className="rounded-md border-2 border-danger bg-danger/5 p-4 focus:outline-none scroll-mt-36"
    >
      <h2 className="flex items-center gap-2 font-sans text-base font-bold text-danger">
        <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
        {total === 1 ? "Falta completar 1 dato" : `Faltan por completar ${total} datos`}
      </h2>
      <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
        {secciones.filter((s) => s.faltan > 0).map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="font-semibold text-danger underline">{s.titulo}</a>
            {" — "}{textoFaltan(s.faltan).toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}
