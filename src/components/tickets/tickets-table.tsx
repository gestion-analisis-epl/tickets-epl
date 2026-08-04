"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type { Ticket } from "@/types/ticket";
import { findServicio } from "@/lib/catalogo";
import { formatFecha } from "@/lib/format-fecha";
import { EstatusBadge, CategoriaBadge } from "@/components/ui/badge";

// ── Filters ───────────────────────────────────────────────────────────────────

const multiSelectFilter: FilterFn<Ticket> = (row, columnId, filterValue: string[]) =>
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
  column: Column<Ticket, unknown>;
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

function ColumnVisibilityMenu({ columns }: { columns: Column<Ticket, unknown>[] }) {
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

function getExportValue(columnId: string, t: Ticket): string | number {
  switch (columnId) {
    case "folio":                     return t.folio;
    case "fechaSolicitud":            return t.fechaSolicitud;
    case "solicitanteNombre":         return t.solicitanteNombre;
    case "areaEmpresa":               return t.areaEmpresa;
    case "servicio":                  return findServicio(t.servicioId)?.servicio ?? t.servicioId;
    case "categoria":                 return t.categoria;
    case "estatus":                   return t.estatus;
    case "abogadoAsignadoId":         return t.abogadoAsignadoId ?? "Sin asignar";
    case "slaInterno":                return t.slaInterno;
    case "diasHabilesTranscurridos":  return t.diasHabilesTranscurridos ?? "";
    case "nivelServicio":             return t.nivelServicio ?? "";
    case "diasPipeline":              return t.diasPipeline ?? "";
    case "fechaCierre":               return t.fechaCierre ?? "";
    default:                          return "";
  }
}

const columnHelper = createColumnHelper<Ticket>();
const PAGE_SIZES = [10, 25, 50, 100];

export function TicketsTable({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const [sorting, setSorting]             = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter]   = useState("");
  const [pagination, setPagination]       = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [columnVisibility, setColumnVisibility] = useLocalStorage<VisibilityState>("tickets-table:visibility", {});

  const columns = useMemo(() => [
    columnHelper.accessor("folio", {
      header: "Folio",
      size: 100, minSize: 90,
      enableColumnFilter: false,
      cell: (info) => (
        <Link href={`/tickets/${info.row.original.id}`} className="font-medium tabular-nums text-primary hover:underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("fechaSolicitud", {
      header: "Fecha",
      size: 110, minSize: 90,
      enableColumnFilter: false,
      cell: (info) => <span className="tabular-nums">{formatFecha(info.getValue())}</span>,
    }),
    columnHelper.accessor("solicitanteNombre", {
      header: "Solicitante",
      size: 170, minSize: 120,
      enableColumnFilter: false,
    }),
    columnHelper.accessor("areaEmpresa", {
      header: "Area / Empresa",
      size: 160, minSize: 120,
      filterFn: multiSelectFilter,
      enableGlobalFilter: false,
    }),
    columnHelper.display({
      id: "servicio",
      header: "Servicio",
      size: 240, minSize: 160,
      enableColumnFilter: false,
      enableSorting: false,
      cell: (info) => {
        const servicio = findServicio(info.row.original.servicioId);
        return <span className="truncate block">{servicio?.servicio ?? info.row.original.servicioId}</span>;
      },
    }),
    columnHelper.accessor("categoria", {
      header: "Categoria",
      size: 170, minSize: 130,
      filterFn: multiSelectFilter,
      enableGlobalFilter: false,
      cell: (info) => <CategoriaBadge categoria={info.getValue()} />,
    }),
    columnHelper.accessor("estatus", {
      header: "Estatus",
      size: 230, minSize: 170,
      filterFn: multiSelectFilter,
      enableGlobalFilter: false,
      cell: (info) => <EstatusBadge estatus={info.getValue()} />,
    }),
    columnHelper.accessor((row) => row.abogadoAsignadoId ?? "Sin asignar", {
      id: "abogadoAsignadoId",
      header: "Abogado asignado",
      size: 170, minSize: 130,
      filterFn: multiSelectFilter,
      enableGlobalFilter: false,
      cell: (info) => {
        const v = info.getValue();
        return v === "Sin asignar"
          ? <span className="opacity-50">Sin asignar</span>
          : <span>{v}</span>;
      },
    }),
    columnHelper.accessor("slaInterno", {
      header: "SLA (dias)",
      size: 100, minSize: 90,
      enableColumnFilter: false,
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor("diasHabilesTranscurridos", {
      header: "Dias transcurridos",
      size: 130, minSize: 110,
      enableColumnFilter: false,
      cell: (info) => {
        const v = info.getValue();
        return <span className="tabular-nums">{v ?? "—"}</span>;
      },
    }),
    columnHelper.accessor("nivelServicio", {
      header: "Nivel de servicio",
      size: 140, minSize: 110,
      enableColumnFilter: false,
      cell: (info) => {
        const v = info.getValue();
        if (v == null) return <span className="opacity-50">—</span>;
        return (
          <span className={cn("tabular-nums font-medium", v < 0 ? "text-danger" : "text-success")}>
            {v > 0 ? `+${v}` : v}
          </span>
        );
      },
    }),
    columnHelper.accessor("diasPipeline", {
      header: "Dias en pipeline",
      size: 130, minSize: 110,
      enableColumnFilter: false,
      cell: (info) => {
        const v = info.getValue();
        return <span className="tabular-nums">{v ?? "—"}</span>;
      },
    }),
    columnHelper.accessor("fechaCierre", {
      header: "Fecha de cierre",
      size: 150, minSize: 120,
      enableColumnFilter: false,
      cell: (info) => <span className="tabular-nums">{formatFecha(info.getValue(), { conHora: true })}</span>,
    }),
  ], []);

  const table = useReactTable({
    data: tickets,
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
    const ws = wb.addWorksheet("Tickets");

    ws.columns = visibleCols.map((col) => ({
      header: typeof col.columnDef.header === "string" ? col.columnDef.header : col.id,
      key: col.id,
      width: 22,
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
    a.download = `tickets_legal_epl_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
            placeholder="Buscar solicitante..."
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
          <div
            className="overflow-auto max-h-[max(320px,calc(100vh-320px))]"
            style={{ cursor: isResizing ? "col-resize" : undefined }}
          >
            <table className="w-full text-sm" style={{ minWidth: table.getCenterTotalSize(), tableLayout: "fixed" }}>
              <colgroup>
                {table.getFlatHeaders().map((h) => <col key={h.id} style={{ width: h.getSize() }} />)}
              </colgroup>

              <thead className="sticky top-0 z-10">
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
                    onDoubleClick={() => router.push(`/tickets/${row.original.id}`)}
                    title="Doble clic para ver el detalle"
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-surface/60 transition-colors cursor-pointer",
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
                {pageStart}–{pageEnd} de {filteredCount} ticket{filteredCount !== 1 ? "s" : ""}
                {filteredCount < tickets.length && <span className="opacity-40"> (de {tickets.length})</span>}
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
