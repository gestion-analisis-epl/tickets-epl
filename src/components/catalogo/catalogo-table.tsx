"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import ExcelJS from "exceljs";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type VisibilityState,
  type FilterFn,
  type Column,
} from "@tanstack/react-table";
import {
  ArrowUp, ArrowDown, ArrowUpDown, ListFilter, Search,
  ChevronLeft, ChevronRight, Columns3, FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { CatalogoServicio } from "@/types/catalogo";
import { CategoriaBadge } from "@/components/ui/badge";

// ── Filters ───────────────────────────────────────────────────────────────────

const multiSelectFilter: FilterFn<CatalogoServicio> = (row, columnId, filterValue: string[]) =>
  filterValue.includes(String(row.getValue(columnId) ?? ""));
multiSelectFilter.autoRemove = (val: string[]) => !val?.length;

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc")  return <ArrowUp className="h-3 w-3 text-primary shrink-0" />;
  if (sorted === "desc") return <ArrowDown className="h-3 w-3 text-primary shrink-0" />;
  return <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-70 shrink-0 transition-opacity" />;
}

function FilterDropdown({
  column,
  renderLabel,
}: {
  column: Column<CatalogoServicio, unknown>;
  renderLabel?: (v: string) => React.ReactNode;
}) {
  const [open, setOpen]     = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef              = useRef<HTMLButtonElement>(null);
  const dropRef             = useRef<HTMLDivElement>(null);

  const filterValue  = (column.getFilterValue() as string[]) ?? [];
  const isActive     = filterValue.length > 0;
  const uniqueValues = Array.from(column.getFacetedUniqueValues().keys())
    .filter((v) => v != null && v !== "")
    .map(String)
    .sort();

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
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
        className={cn("relative p-0.5 rounded transition-colors shrink-0", isActive ? "text-primary" : "opacity-40 hover:opacity-80")}
        title="Filtrar columna"
      >
        <ListFilter className="h-3.5 w-3.5" />
        {isActive && <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />}
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 9999 }}
          className="bg-card text-card-foreground rounded-lg border border-border shadow-lg min-w-[200px] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
            <span className="text-xs font-semibold opacity-80">Filtrar por valor</span>
            {isActive && (
              <button type="button" onClick={() => column.setFilterValue(undefined)} className="text-xs text-primary hover:underline">
                Limpiar
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {uniqueValues.map((value) => (
              <label key={value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterValue.includes(value)}
                  onChange={() => setFilter(value)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring cursor-pointer shrink-0"
                />
                <span className="text-sm leading-none">{renderLabel ? renderLabel(value) : value}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function ColumnVisibilityMenu({ columns }: { columns: Column<CatalogoServicio, unknown>[] }) {
  const [open, setOpen]     = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef              = useRef<HTMLButtonElement>(null);
  const dropRef             = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
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
        className="flex items-center gap-1.5 h-8 rounded-lg border border-border bg-card px-3 text-sm hover:bg-surface transition-colors shrink-0"
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
            <span className="text-xs font-semibold opacity-80">Mostrar columnas</span>
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

// ── Export values (respeta columnas visibles y filas filtradas) ─────────────

function getExportValue(columnId: string, s: CatalogoServicio): string | number {
  switch (columnId) {
    case "id":                return s.id;
    case "puestoResponsable":  return s.puestoResponsable;
    case "servicio":           return s.servicio;
    case "solicitanteTipico":  return s.solicitanteTipico;
    case "categoria":          return s.categoria;
    case "slaInterno":         return s.slaInterno;
    case "slaDespachoRef":     return s.slaDespachoRef;
    default:                  return "";
  }
}

const columnHelper = createColumnHelper<CatalogoServicio>();
const PAGE_SIZES = [10, 25, 50, 100];

export function CatalogoTable({ data }: { data: CatalogoServicio[] }) {
  const [sorting, setSorting]             = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter]   = useState("");
  const [pagination, setPagination]       = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [columnVisibility, setColumnVisibility] = useLocalStorage<VisibilityState>("catalogo-table:visibility", {});

  const columns = useMemo(() => [
    columnHelper.accessor("id", {
      header: "ID",
      size: 100, minSize: 90,
      enableColumnFilter: false,
      cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor("puestoResponsable", {
      header: "Puesto responsable",
      size: 190, minSize: 140,
      filterFn: multiSelectFilter,
      enableGlobalFilter: false,
    }),
    columnHelper.accessor("servicio", {
      header: "Servicio estandarizado",
      size: 280, minSize: 180,
      enableColumnFilter: false,
      cell: (info) => <span className="truncate block">{info.getValue()}</span>,
    }),
    columnHelper.accessor("solicitanteTipico", {
      header: "Solicitante tipico",
      size: 180, minSize: 130,
      enableColumnFilter: false,
    }),
    columnHelper.accessor("categoria", {
      header: "Categoria",
      size: 170, minSize: 130,
      filterFn: multiSelectFilter,
      enableGlobalFilter: false,
      cell: (info) => <CategoriaBadge categoria={info.getValue()} />,
    }),
    columnHelper.accessor("slaInterno", {
      header: "SLA interno (dias)",
      size: 130, minSize: 110,
      enableColumnFilter: false,
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor("slaDespachoRef", {
      header: "SLA despacho ref. (dias)",
      size: 150, minSize: 120,
      enableColumnFilter: false,
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
  ], []);

  const table = useReactTable({
    data,
    columns,
    columnResizeMode: "onChange",
    globalFilterFn: "includesString",
    state: { sorting, columnFilters, globalFilter, pagination, columnVisibility },
    onSortingChange:         setSorting,
    onColumnFiltersChange:   setColumnFilters,
    onGlobalFilterChange:    setGlobalFilter,
    onPaginationChange:      setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel:        getCoreRowModel(),
    getSortedRowModel:      getSortedRowModel(),
    getFilteredRowModel:    getFilteredRowModel(),
    getPaginationRowModel:  getPaginationRowModel(),
    getFacetedRowModel:     getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const rows          = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const isResizing    = !!table.getState().columnSizingInfo.isResizingColumn;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount  = table.getPageCount();
  const pageStart  = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd    = Math.min((pageIndex + 1) * pageSize, filteredCount);
  const hasFilters = columnFilters.length > 0 || globalFilter !== "";
  const toggleableColumns = table.getAllLeafColumns();

  const exportToExcel = async () => {
    const visibleCols = table.getVisibleLeafColumns();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Catalogo");

    ws.columns = visibleCols.map((col) => ({
      header: typeof col.columnDef.header === "string" ? col.columnDef.header : col.id,
      key: col.id,
      width: 24,
    }));

    table.getFilteredRowModel().rows.forEach((row) => {
      const rowData: Record<string, string | number> = {};
      visibleCols.forEach((col) => { rowData[col.id] = getExportValue(col.id, row.original); });
      ws.addRow(rowData);
    });

    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: visibleCols.length } };

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url;
    a.download = `catalogo_servicios_legal_epl_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-50 pointer-events-none" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar servicio..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <ColumnVisibilityMenu columns={toggleableColumns} />
          <button
            type="button"
            onClick={exportToExcel}
            className="flex items-center gap-1.5 h-8 rounded-lg border border-border bg-card px-3 text-sm hover:bg-surface transition-colors shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar Excel
          </button>
        </div>
      </div>

      {filteredCount === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-card rounded-lg border border-border text-center">
          <p className="text-sm font-medium opacity-70">Sin resultados</p>
          <p className="text-xs opacity-50 mt-1">Ajusta los filtros o la busqueda</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto" style={{ cursor: isResizing ? "col-resize" : undefined }}>
            <table className="w-full text-sm" style={{ minWidth: table.getCenterTotalSize(), tableLayout: "fixed" }}>
              <colgroup>
                {table.getFlatHeaders().map((h) => <col key={h.id} style={{ width: h.getSize() }} />)}
              </colgroup>

              <thead>
                <tr className="bg-surface border-b border-border">
                  {table.getFlatHeaders().map((header) => {
                    const canSort   = header.column.getCanSort();
                    const canFilter = header.column.getCanFilter();
                    const sorted    = header.column.getIsSorted();
                    return (
                      <th key={header.id} className="relative px-4 py-3 text-left overflow-visible">
                        <div className="flex items-center gap-1.5 select-none min-w-0">
                          {canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="group flex items-center gap-1 text-xs font-semibold uppercase tracking-wider opacity-70 hover:opacity-100 transition-opacity min-w-0 truncate"
                            >
                              <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                              <SortIcon sorted={sorted} />
                            </button>
                          ) : (
                            <span className="text-xs font-semibold uppercase tracking-wider opacity-70 truncate">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
                          )}
                          {canFilter && <FilterDropdown column={header.column} />}
                        </div>

                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none transition-colors",
                              header.column.getIsResizing() ? "bg-primary" : "bg-transparent hover:bg-primary/40"
                            )}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-surface/60 transition-colors",
                      rowIndex % 2 === 1 && "bg-surface/30"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 overflow-hidden">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-surface flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <p className="text-xs opacity-60">
                {pageStart}–{pageEnd} de {filteredCount} servicio{filteredCount !== 1 ? "s" : ""}
                {filteredCount < data.length && <span className="opacity-40"> (de {data.length})</span>}
              </p>
              {hasFilters && (
                <button onClick={() => { setColumnFilters([]); setGlobalFilter(""); }} className="text-xs text-primary hover:underline">
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs opacity-60">Filas:</span>
                <select
                  value={pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                  className="text-xs border border-border rounded px-1.5 py-0.5 bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1 rounded hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs min-w-[56px] text-center opacity-70">{pageIndex + 1} / {pageCount}</span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-1 rounded hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
