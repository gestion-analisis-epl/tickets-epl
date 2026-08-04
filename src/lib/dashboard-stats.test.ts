import { describe, it, expect } from "vitest";
import { computeDashboardStats } from "./dashboard-stats";
import { buildTicket } from "@/test/ticket-fixture";
import type { Ticket } from "@/types/ticket";

function porLabel(entries: { label: string; value: number }[], label: string): number | undefined {
  return entries.find((e) => e.label === label)?.value;
}

const CATEGORIAS = ["Servicios extraordinarios", "Control documental", "Contratos", "Licencias y permisos", "Arrendamientos"];

describe("computeDashboardStats", () => {
  it("con una lista vacia regresa ceros y null en los promedios/porcentajes", () => {
    const stats = computeDashboardStats([], CATEGORIAS);

    expect(stats.total).toBe(0);
    expect(stats.activos).toBe(0);
    expect(stats.cerrados).toBe(0);
    expect(stats.cumplimientoSLA).toBeNull();
    expect(stats.satisfaccionPromedio).toBeNull();
    expect(stats.porAbogado).toEqual([]);
    // porEstatus/porCategoria cubren todas las categorias/estatus fijos, aunque no haya tickets.
    expect(stats.porEstatus.every((e) => e.value === 0)).toBe(true);
    expect(stats.porCategoria.every((e) => e.value === 0)).toBe(true);
  });

  const tickets: Ticket[] = [
    buildTicket({
      id: "t1", estatus: "Cierre", categoria: "Contratos",
      abogadoAsignadoId: "ab1", nivelServicio: 2, satisfaccion: 8,
    }),
    buildTicket({
      id: "t2", estatus: "Cierre", categoria: "Contratos",
      abogadoAsignadoId: "ab1", nivelServicio: -1, satisfaccion: 6,
    }),
    buildTicket({
      // Cerrado sin haber asignado abogado nunca: nivelServicio nunca se calculo (null).
      id: "t3", estatus: "Cierre", categoria: "Licencias y permisos",
      abogadoAsignadoId: null, nivelServicio: null,
    }),
    buildTicket({
      id: "t4", estatus: "Proceso en tramite", categoria: "Control documental",
      abogadoAsignadoId: "ab2",
    }),
    buildTicket({
      id: "t5", estatus: "Recepcion de solicitud", categoria: "Contratos",
      abogadoAsignadoId: "ab1",
    }),
  ];

  it("cuenta total/activos/cerrados correctamente", () => {
    const stats = computeDashboardStats(tickets, CATEGORIAS);
    expect(stats.total).toBe(5);
    expect(stats.cerrados).toBe(3);
    expect(stats.activos).toBe(2);
  });

  it("cumplimientoSLA solo considera cerrados con nivelServicio calculado", () => {
    const stats = computeDashboardStats(tickets, CATEGORIAS);
    // De los 3 cerrados, solo t1 y t2 tienen nivelServicio (t3 nunca tuvo abogado asignado).
    // De esos 2, solo t1 cumplio SLA (nivelServicio >= 0) -> 1/2 = 50%.
    expect(stats.cumplimientoSLA).toBe(50);
  });

  it("cumplimientoSLA es null si ningun cerrado tiene nivelServicio calculado", () => {
    const soloSinSLA = [buildTicket({ estatus: "Cierre", nivelServicio: null })];
    expect(computeDashboardStats(soloSinSLA, CATEGORIAS).cumplimientoSLA).toBeNull();
  });

  it("satisfaccionPromedio promedia solo los tickets que ya fueron calificados", () => {
    const stats = computeDashboardStats(tickets, CATEGORIAS);
    // Solo t1 (8) y t2 (6) tienen satisfaccion: (8 + 6) / 2 = 7
    expect(stats.satisfaccionPromedio).toBe(7);
  });

  it("redondea satisfaccionPromedio a 1 decimal", () => {
    const conDecimales = [
      buildTicket({ satisfaccion: 9 }),
      buildTicket({ satisfaccion: 8 }),
      buildTicket({ satisfaccion: 8 }),
    ];
    // (9 + 8 + 8) / 3 = 8.333... -> 8.3
    expect(computeDashboardStats(conDecimales, CATEGORIAS).satisfaccionPromedio).toBe(8.3);
  });

  it("porCategoria agrupa por categoria, incluyendo categorias sin tickets", () => {
    const stats = computeDashboardStats(tickets, CATEGORIAS);
    expect(porLabel(stats.porCategoria, "Contratos")).toBe(3);
    expect(porLabel(stats.porCategoria, "Licencias y permisos")).toBe(1);
    expect(porLabel(stats.porCategoria, "Control documental")).toBe(1);
    expect(porLabel(stats.porCategoria, "Servicios extraordinarios")).toBe(0);
    expect(porLabel(stats.porCategoria, "Arrendamientos")).toBe(0);
  });

  it("porEstatus agrupa por estatus, incluyendo estatus sin tickets", () => {
    const stats = computeDashboardStats(tickets, CATEGORIAS);
    expect(porLabel(stats.porEstatus, "Cierre")).toBe(3);
    expect(porLabel(stats.porEstatus, "Proceso en tramite")).toBe(1);
    expect(porLabel(stats.porEstatus, "Recepcion de solicitud")).toBe(1);
    expect(porLabel(stats.porEstatus, "Asignacion de responsable")).toBe(0);
  });

  it("porAbogado excluye tickets sin abogado y ordena descendente por conteo", () => {
    const stats = computeDashboardStats(tickets, CATEGORIAS);
    // ab1: t1, t2, t5 = 3; ab2: t4 = 1; t3 sin abogado no cuenta.
    expect(stats.porAbogado).toEqual([
      { label: "ab1", value: 3 },
      { label: "ab2", value: 1 },
    ]);
  });
});
