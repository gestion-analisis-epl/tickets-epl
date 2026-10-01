import type { Column, FilterFn, RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    // Como se agrupa/etiqueta el valor de la celda en el filtro del encabezado
    // (ej. fechas con hora se agrupan por dia). Por defecto: String(valor).
    filterLabel?: (v: unknown) => string;
  }
}

// Clave de los valores vacios (null/undefined/""): se muestran como "(Vacio)".
export const FILTRO_VACIO = "";

const defaultLabel = (v: unknown) => (v == null ? "" : String(v));

export function multiSelectColumn<T>(label: (v: unknown) => string = defaultLabel) {
  const filterFn: FilterFn<T> = (row, columnId, filterValue: string[]) =>
    filterValue.includes(label(row.getValue(columnId)));
  filterFn.autoRemove = (val: string[]) => !val?.length;
  return { filterFn, meta: { filterLabel: label } };
}

function compareRaw(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { numeric: true });
}

// Opciones del dropdown: valores unicos (ya agrupados por etiqueta), ordenados
// por el valor crudo, con el vacio al final.
export function facetOptions<T>(column: Column<T, unknown>): string[] {
  const label = column.columnDef.meta?.filterLabel ?? defaultLabel;
  const byLabel = new Map<string, unknown>();
  for (const raw of Array.from(column.getFacetedUniqueValues().keys())) {
    const l = label(raw);
    if (!byLabel.has(l)) byLabel.set(l, raw);
  }
  return Array.from(byLabel.entries())
    .sort(([la, a], [lb, b]) => {
      if (la === FILTRO_VACIO) return 1;
      if (lb === FILTRO_VACIO) return -1;
      return compareRaw(a, b);
    })
    .map(([l]) => l);
}
