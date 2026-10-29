interface BarraAccionesProps {
  estado: string;
  children: React.ReactNode;
}

// Barra pegada al borde inferior: siempre a la vista, dice cuanto falta y junta las acciones del formulario.
export function BarraAcciones({ estado, children }: BarraAccionesProps) {
  return (
    <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border bg-card px-4 py-3 shadow-[0_-6px_18px_rgb(0_0_0/0.06)]">
      <p aria-live="polite" className="text-sm font-semibold">{estado}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
