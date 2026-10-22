"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "@tanstack/react-table";
import { Loader2, Search, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumenes } from "@/hooks/use-resumenes-contrato";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSessionStorage } from "@/hooks/use-session-storage";
import { Badge, EstatusBadge } from "@/components/ui/badge";
import { SortIcon, FilterDropdown, ColumnVisibilityMenu } from "@/components/ui/tabla-controles";
import { enCorreccion } from "@/domain/contratos/resumen-presentacion";
import { multiSelectColumn } from "@/lib/table-filter";
import { normalizar } from "@/lib/busqueda";
import type { ResumenContrato } from "@/types/resumen-contrato";

const busquedaGlobal: FilterFn<ResumenContrato> = (row, columnId, filterValue: string) =>
  normalizar(row.getValue(columnId)).includes(normalizar(filterValue).trim());

const multiSelect = multiSelectColumn<ResumenContrato>;
const columnHelper = createColumnHelper<ResumenContrato>();
const PAGE_SIZES = [10, 25, 50, 100];

const textoVistoBueno = (r: ResumenContrato) => (r.vistoBueno ? `Dado por ${r.vistoBueno.nombre}` : "Pendiente");
const textoEtapa = (r: ResumenContrato) => (enCorreccion(r.estatus) ? `${r.estatus} (En correccion)` : r.estatus);

export function PreCierreLista() {
  const { resumenes, loading, error } = useResumenes();
  const router = useRouter();
  const [sorting, setSorting]             = useSessionStorage<SortingState>("pre-cierre-table:sorting", []);
  const [columnFilters, setColumnFilters] = useSessionStorage<ColumnFiltersState>("pre-cierre-table:filters", []);
  const [globalFilter, setGlobalFilter]   = useSessionStorage("pre-cierre-table:search", "");
  const [pagination, setPagination]       = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [columnVisibility, setColumnVisibility] = useLocalStorage<VisibilityState>("pre-cierre-table:visibility", {});

  const columns = useMemo(() => [
    columnHelper.accessor("folio", {
      ...multiSelect(),
      header: "Folio",
      size: 110, minSize: 90,
      cell: (info) => (
        <Link href={`/pre-cierre/${info.row.original.ticketId}`} className="font-medium tabular-nums hover:underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor((r) => r.sitioClave ?? "—", {
      id: "sitioClave",
      header: "Clave sitio",
      size: 120, minSize: 90,
      ...multiSelect(),
      cell: (info) => <span className="truncate block tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor((r) => r.sitioAlias ?? "—", {
      id: "sitioAlias",
      header: "Alias sitio",
      size: 200, minSize: 130,
      ...multiSelect(),
      cell: (info) => <span className="truncate block">{info.getValue()}</span>,
    }),
    columnHelper.accessor("solicitante", {
      ...multiSelect(),
      header: "Solicitante",
      size: 180, minSize: 120,
    }),
    columnHelper.accessor(textoEtapa, {
      id: "etapa",
      header: "Etapa",
      size: 260, minSize: 170,
      ...multiSelect(),
      cell: (info) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <EstatusBadge estatus={info.row.original.estatus} />
          {enCorreccion(info.row.original.estatus) && <Badge tone="orange">En correccion</Badge>}
        </div>
      ),
    }),
    columnHelper.accessor(textoVistoBueno, {
      id: "vistoBueno",
      header: "Visto bueno",
      size: 220, minSize: 150,
      ...multiSelect(),
      cell: (info) =>
        info.row.original.vistoBueno
          ? <Badge tone="green">{info.getValue()}</Badge>
          : <Badge tone="gray">Pendiente</Badge>,
    }),
  ], []);

  const table = useReactTable({
    data: resumenes,
    columns,
    columnResizeMode: "onChange",
    globalFilterFn: busquedaGlobal,
    state: { sorting, columnFilters, globalFilter, pagination, columnVisibility },
    onSortingChange:          setSorting,
    onColumnFiltersChange:    setColumnFilters,
    onGlobalFilterChange:     setGlobalFilter,
    onPaginationChange:       setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel:        getCoreRowModel(),
    getSortedRowModel:      getSortedRowModel(),
    getFilteredRowModel:    getFilteredRowModel(),
    getPaginationRowModel:  getPaginationRowModel(),
    getFacetedRowModel:     getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Mismo criterio que la tabla de tickets: al filtrar o buscar se vuelve a la primera pagina.
  useEffect(() => { table.setPageIndex(0); }, [columnFilters, globalFilter, table]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-card rounded-lg border border-border text-center">
        <p className="text-sm font-medium text-danger">No se pudo cargar la lista</p>
        <p className="text-xs text-muted mt-1">Si el problema continua, avisa a Mesa de Control.</p>
      </div>
    );
  }

  if (resumenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-card rounded-lg border border-border text-center">
        <p className="text-sm font-medium text-muted">Sin tickets en Pre-Cierre ni Cierre</p>
        <p className="text-xs text-muted mt-1">Aqui apareceran los contratos pendientes de visto bueno, los que regresaron a correccion y los ya cerrados</p>
      </div>
    );
  }

  const rows          = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const isResizing    = !!table.getState().columnSizingInfo.isResizingColumn;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount  = table.getPageCount();
  const pageStart  = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd    = Math.min((pageIndex + 1) * pageSize, filteredCount);
  const hasFilters = columnFilters.length > 0 || globalFilter !== "";

  const exportToExcel = async () => {
    const visibleCols = table.getVisibleLeafColumns();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pre-Cierre y Cierre");

    ws.columns = visibleCols.map((col) => ({
      header: typeof col.columnDef.header === "string" ? col.columnDef.header : col.id,
      key: col.id,
      width: 24,
    }));

    table.getFilteredRowModel().rows.forEach((row) => {
      const rowData: Record<string, string | number> = {};
      visibleCols.forEach((col) => { rowData[col.id] = String(row.getValue(col.id) ?? ""); });
      ws.addRow(rowData);
    });

    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: visibleCols.length } };

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url;
    a.download = `pre_cierre_legal_epl_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar por folio, sitio, solicitante, etapa o visto bueno..."
            className="field w-full pl-9 pr-3"
          />
        </div>
        <div className="flex items-center gap-2">
          <ColumnVisibilityMenu columns={table.getAllLeafColumns()} />
          <button
            type="button"
            onClick={exportToExcel}
            className="flex items-center gap-1.5 h-8 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-surface transition-colors shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar Excel
          </button>
        </div>
      </div>

      {filteredCount === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-card rounded-lg border border-border text-center">
          <p className="text-sm font-medium text-muted">Sin resultados</p>
          <p className="text-xs text-muted mt-1">Ajusta los filtros o la busqueda</p>
        </div>
      ) : (
        <div className="rounded-md border border-border border-t-2 border-t-accent overflow-hidden bg-card">
          <div
            className="overflow-auto max-h-[max(320px,calc(100vh-320px))]"
            style={{ cursor: isResizing ? "col-resize" : undefined }}
          >
            <table className="w-full text-sm" style={{ minWidth: table.getCenterTotalSize(), tableLayout: "fixed" }}>
              <colgroup>
                {table.getFlatHeaders().map((h) => <col key={h.id} style={{ width: h.getSize() }} />)}
              </colgroup>

              <thead className="sticky top-0 z-10">
                <tr className="bg-surface border-b-2 border-foreground/15">
                  {table.getFlatHeaders().map((header) => (
                    <th key={header.id} className="relative px-4 py-3 text-left overflow-visible">
                      <div className="flex items-center gap-1.5 select-none min-w-0">
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="group flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] hover:text-foreground transition-opacity min-w-0 truncate"
                          >
                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            <SortIcon sorted={header.column.getIsSorted()} />
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                        )}
                        {header.column.getCanFilter() && <FilterDropdown column={header.column} />}
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
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    onDoubleClick={() => router.push(`/pre-cierre/${row.original.ticketId}`)}
                    title="Doble clic para ver el detalle"
                    className={cn(
                      "border-b border-border/70 last:border-0 hover:bg-accent/10 transition-colors cursor-pointer",
                      rowIndex % 2 === 1 && "bg-surface/40"
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

          <div className="px-4 py-2.5 border-t border-border bg-surface flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted">
                {pageStart}–{pageEnd} de {filteredCount} ticket{filteredCount !== 1 ? "s" : ""}
                {filteredCount < resumenes.length && <span> (de {resumenes.length})</span>}
              </p>
              {hasFilters && (
                <button onClick={() => { setColumnFilters([]); setGlobalFilter(""); }} className="text-xs text-primary hover:underline">
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted">Filas:</span>
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
                <span className="text-xs min-w-[56px] text-center text-muted">{pageIndex + 1} / {pageCount}</span>
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
