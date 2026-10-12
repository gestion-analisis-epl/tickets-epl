import type { ReactNode } from "react";

interface DosColumnasProps {
  encabezado?: ReactNode;
  izquierda: ReactNode;
  derecha: ReactNode;
  mostrarDerecha?: boolean;
}

// El encabezado va sobre las dos columnas para que ambas arranquen a la misma altura.
export function DosColumnas({ encabezado, izquierda, derecha, mostrarDerecha = true }: DosColumnasProps) {
  if (!mostrarDerecha) {
    return (
      <div className="max-w-3xl space-y-6">
        {encabezado}
        {izquierda}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {encabezado}
      <div className="space-y-6 lg:grid lg:max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_minmax(420px,5fr)] lg:items-stretch lg:gap-8 lg:space-y-0 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">{izquierda}</div>
        {/* h-0 + min-h-full: la derecha mide lo mismo que la izquierda y nunca la alarga; lo que sobre se desplaza en su panel. */}
        <aside className="space-y-6 lg:flex lg:h-0 lg:min-h-full lg:flex-col lg:gap-6 lg:space-y-0 lg:overflow-y-auto">
          {derecha}
        </aside>
      </div>
    </div>
  );
}
