import type { ReactNode } from "react";

interface DosColumnasProps {
  izquierda: ReactNode;
  derecha: ReactNode;
  mostrarDerecha?: boolean;
}

export function DosColumnas({ izquierda, derecha, mostrarDerecha = true }: DosColumnasProps) {
  if (!mostrarDerecha) return <>{izquierda}</>;

  return (
    <div className="space-y-6 lg:grid lg:max-w-7xl lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="min-w-0">{izquierda}</div>
      <aside className="space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
        {derecha}
      </aside>
    </div>
  );
}
