"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ArrowDown, ArrowUpDown, ListFilter, Columns3 } from "lucide-react";
import type { Column } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { facetOptions, FILTRO_VACIO } from "@/lib/table-filter";

// Controles de encabezado compartidos por las tablas de tickets y de Pre-Cierre/Cierre.

export function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc")  return <ArrowUp className="h-3 w-3 text-primary shrink-0" />;
  if (sorted === "desc") return <ArrowDown className="h-3 w-3 text-primary shrink-0" />;
  return <ArrowUpDown className="h-3 w-3 text-muted group-hover:text-foreground shrink-0 transition-opacity" />;
}

export function FilterDropdown<T>({
  column,
  renderLabel,
}: {
  column: Column<T, unknown>;
  renderLabel?: (v: string) => React.ReactNode;
}) {
  const [open, setOpen]     = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef              = useRef<HTMLButtonElement>(null);
  const dropRef             = useRef<HTMLDivElement>(null);

  const filterValue  = (column.getFilterValue() as string[]) ?? [];
  const isActive     = filterValue.length > 0;
  const uniqueValues = facetOptions(column);
  const [query, setQuery] = useState("");
  const visibles = uniqueValues.filter((v) => (v === FILTRO_VACIO ? "(vacio)" : v).toLowerCase().includes(query.trim().toLowerCase()));

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Clamp para que el panel (min-w 200px) no se salga por la derecha en
      // pantallas angostas — sin esto, un filtro cerca del borde derecho de
      // una tabla con scroll horizontal quedaba parcial o totalmente oculto.
      const left = Math.min(r.left, window.innerWidth - 216);
      setCoords({ top: r.bottom + 4, left: Math.max(8, left) });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dropRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t))  return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const setFilter = (value: string) => {
    const next = filterValue.includes(value)
      ? filterValue.filter((v) => v !== value)
      : [...filterValue, value];
    column.setFilterValue(next.length ? next : undefined);
  };

  if (uniqueValues.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={cn("relative p-0.5 rounded transition-colors shrink-0", isActive ? "text-primary" : "text-muted hover:text-foreground")}
        title="Filtrar columna"
      >
        <ListFilter className="h-3.5 w-3.5" />
        {isActive && <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary dark:bg-primary-text rounded-full" />}
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }}
          className="bg-card text-card-foreground rounded-lg border border-border shadow-lg min-w-[200px] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
            <span className="text-xs font-semibold text-muted">Filtrar por valor</span>
            {isActive && (
              <button type="button" onClick={() => column.setFilterValue(undefined)} className="text-xs text-primary hover:underline">
                Limpiar
              </button>
            )}
          </div>
          {uniqueValues.length > 8 && (
            <div className="px-3 py-2 border-b border-border">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar valor..."
                className="field h-8 w-full text-xs"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {visibles.length === 0 && <p className="px-3 py-2 text-xs text-muted">Sin coincidencias</p>}
            {visibles.map((value) => (
              <label key={value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterValue.includes(value)}
                  onChange={() => setFilter(value)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring cursor-pointer shrink-0"
                />
                <span className="text-sm leading-none">{value === FILTRO_VACIO ? <span className="italic">(Vacio)</span> : renderLabel ? renderLabel(value) : value}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function ColumnVisibilityMenu<T>({ columns }: { columns: Column<T, unknown>[] }) {
  const [open, setOpen]     = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef              = useRef<HTMLButtonElement>(null);
  const dropRef             = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const left = Math.min(r.left, window.innerWidth - 226);
      setCoords({ top: r.bottom + 4, left: Math.max(8, left) });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dropRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t))  return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const hiddenCount = columns.filter((c) => !c.getIsVisible()).length;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 h-8 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-surface transition-colors shrink-0"
      >
        <Columns3 className="h-3.5 w-3.5" />
        Columnas
        {hiddenCount > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">{hiddenCount}</span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }}
          className="bg-card text-card-foreground rounded-lg border border-border shadow-lg min-w-[210px] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
            <span className="text-xs font-semibold text-muted">Mostrar columnas</span>
            {hiddenCount > 0 && (
              <button type="button" onClick={() => columns.forEach((c) => c.toggleVisibility(true))} className="text-xs text-primary hover:underline">
                Mostrar todas
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {columns.map((col) => (
              <label key={col.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={col.getToggleVisibilityHandler()}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring cursor-pointer shrink-0"
                />
                <span className="text-sm">{typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
