interface BarItem {
  label: string;
  value: number;
  color: string; // valor de CSS, ej. "var(--chart-1)"
}

/*
 * Lista de barras horizontales para comparar magnitudes entre categorias.
 * Cada categoria ya lleva su nombre como label directo (no hace falta leyenda
 * aparte), y el numero va al final de la barra en columna alineada
 * (tabular-nums), como pide el spec de marcas del skill dataviz.
 */
export function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const pct = Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0);
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="w-44 shrink-0 text-sm truncate" title={item.label}>{item.label}</span>
            <div className="flex-1 h-5 rounded-sm bg-surface overflow-hidden">
              <div
                className="h-full transition-[width] duration-300"
                style={{ width: `${pct}%`, backgroundColor: item.color, borderRadius: "0 4px 4px 0" }}
              />
            </div>
            <span className="w-10 shrink-0 text-sm text-right tabular-nums opacity-80">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
