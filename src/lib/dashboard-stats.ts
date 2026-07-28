import type { Ticket } from "@/types/ticket";
import { ESTATUS_VALUES } from "@/types/ticket";
import type { Categoria } from "@/types/catalogo";

const CATEGORIAS: Categoria[] = ["Contratos", "Licencias y permisos", "Control documental", "Servicios extraordinarios"];

export interface DashboardStats {
  total: number;
  activos: number;
  cerrados: number;
  cumplimientoSLA: number | null; // % de cerrados con nivelServicio >= 0
  satisfaccionPromedio: number | null; // 1-10
  porEstatus: { label: string; value: number }[];
  porCategoria: { label: string; value: number }[];
  porAbogado: { label: string; value: number }[];
}

export function computeDashboardStats(tickets: Ticket[]): DashboardStats {
  const cerrados = tickets.filter((t) => t.estatus === "Cierre");
  const activos = tickets.length - cerrados.length;

  const cerradosConSLA = cerrados.filter((t) => t.nivelServicio != null);
  const cumplimientoSLA = cerradosConSLA.length
    ? Math.round((cerradosConSLA.filter((t) => t.nivelServicio! >= 0).length / cerradosConSLA.length) * 100)
    : null;

  const conSatisfaccion = tickets.filter((t) => t.satisfaccion != null);
  const satisfaccionPromedio = conSatisfaccion.length
    ? Math.round((conSatisfaccion.reduce((sum, t) => sum + t.satisfaccion!, 0) / conSatisfaccion.length) * 10) / 10
    : null;

  const porEstatus = ESTATUS_VALUES.map((estatus) => ({
    label: estatus,
    value: tickets.filter((t) => t.estatus === estatus).length,
  }));

  const porCategoria = CATEGORIAS.map((categoria) => ({
    label: categoria,
    value: tickets.filter((t) => t.categoria === categoria).length,
  }));

  const conteoAbogados = new Map<string, number>();
  tickets.forEach((t) => {
    if (!t.abogadoAsignadoId) return;
    conteoAbogados.set(t.abogadoAsignadoId, (conteoAbogados.get(t.abogadoAsignadoId) ?? 0) + 1);
  });
  const porAbogado = Array.from(conteoAbogados.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    total: tickets.length,
    activos,
    cerrados: cerrados.length,
    cumplimientoSLA,
    satisfaccionPromedio,
    porEstatus,
    porCategoria,
    porAbogado,
  };
}
