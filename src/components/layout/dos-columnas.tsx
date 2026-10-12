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
      <div className="space-y-6 lg:grid lg:max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_minmax(420px,5fr)] lg:items-start lg:gap-8 lg:space-y-0 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">{izquierda}</div>
        <aside className="space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
          {derecha}
        </aside>
      </div>
    </div>
  );
}
